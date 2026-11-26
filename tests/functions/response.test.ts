import { randomUUID } from "node:crypto";
import { ApiError } from "../../functions/shared/http";
import { signEd25519 } from "../../functions/shared/signing";
import { passExpiry } from "../../functions/shared/survey-window";
import { createResponseLambda, createResponseRoutes, responseRoutes } from "../../functions/response/handler";
import { answerKey, commentKey, retrySecretHash, saveOpenResponse, saveTrackedResponse, type TrackedRequest } from "../../functions/response/save-response";
import { apiEvent, createWorld, originValue, survey, volunteerAnswers, window, type World } from "./helpers";

function trackedPass(world: World, linkRef = "L".repeat(43), exp = passExpiry(window)) {
  return signEd25519(world.keys.trackedPass.privateKey, { v: 1, s: survey.surveyId, l: linkRef, exp });
}

function trackedRequest(world: World, overrides: Partial<TrackedRequest> = {}): TrackedRequest {
  return {
    surveyId: survey.surveyId,
    surveyVersion: survey.fingerprint,
    submissionId: randomUUID(),
    retrySecretHash: retrySecretHash("secret-1"),
    trackedPass: trackedPass(world),
    answers: { ...volunteerAnswers, "adult-comments": "Thank you to the leaders." },
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the request to be rejected");
}

describe("tracked responses", () => {
  it("[G6] [G7] saves the answers, claims the link and writes the comment separately", async () => {
    const world = createWorld();
    const request = trackedRequest(world);

    expect(await saveTrackedResponse(world.response, request)).toEqual({ status: "saved" });

    const answers = JSON.parse(world.store.objects.get(`intake/${answerKey(world.keys.response.fileNameKey, request.submissionId)}`)!);
    expect(answers).toEqual({ schemaVersion: "1.0", surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: request.submissionId, source: "tracked", submittedOn: "2027-03-14", answers: volunteerAnswers });
    expect(world.store.objects.get("used/links/" + "L".repeat(43))).toBe(request.retrySecretHash);

    const comment = JSON.parse(world.store.objects.get(`intake/${commentKey(world.keys.response.fileNameKey, request.submissionId, "adult-comments")}`)!);
    expect(comment).toMatchObject({ questionId: "adult-comments", audience: "adult", source: "tracked", submittedOn: "2027-03-14", text: "Thank you to the leaders." });
    expect(JSON.stringify(comment)).not.toContain(request.submissionId);
  });

  it("[G7] a retry with the same submission ID and retry secret saves nothing new", async () => {
    const world = createWorld();
    const request = trackedRequest(world);
    await saveTrackedResponse(world.response, request);
    const before = new Map(world.store.objects);

    expect(await saveTrackedResponse(world.response, request)).toEqual({ status: "saved" });
    expect(world.store.objects).toEqual(before);
  });

  it("[G7] a second response for a used link is refused and its answer file removed", async () => {
    const world = createWorld();
    await saveTrackedResponse(world.response, trackedRequest(world));
    const second = trackedRequest(world, { retrySecretHash: retrySecretHash("another device") });

    expect((await rejection(saveTrackedResponse(world.response, second))).code).toBe("already_completed");
    expect(world.objects("intake/intake/answers/")).toHaveLength(1);
    expect(world.store.objects.has(`intake/${answerKey(world.keys.response.fileNameKey, second.submissionId)}`)).toBe(false);
    expect(world.objects("intake/intake/comments/")).toHaveLength(1);
  });

  it("[G7] a refused claim deletes only an answer file that this request created", async () => {
    const world = createWorld();
    const request = trackedRequest(world);
    const fileKey = answerKey(world.keys.response.fileNameKey, request.submissionId);
    world.store.objects.set(`intake/${fileKey}`, "written earlier");
    world.store.objects.set(`used/links/${"L".repeat(43)}`, retrySecretHash("someone else"));

    expect((await rejection(saveTrackedResponse(world.response, request))).code).toBe("already_completed");
    expect(world.store.objects.get(`intake/${fileKey}`)).toBe("written earlier");
  });

  it("[G7] comment files are written only after the link is claimed", async () => {
    const world = createWorld();
    const order: string[] = [];
    const store = world.store;
    world.response.store = { ...store, putIfAbsent: async (bucket, key, body) => (order.push(key.split("/")[0] === "links" ? "link" : key.split("/")[1]!), store.putIfAbsent(bucket, key, body)) };

    await saveTrackedResponse(world.response, trackedRequest(world));
    expect(order).toEqual(["answers", "link", "comments"]);
  });

  it("[G2] rejects answers that do not belong on the calculated path", async () => {
    const world = createWorld();
    const mixed = trackedRequest(world, { answers: { ...volunteerAnswers, section: "cubs", enjoy: 5 } });
    const error = await rejection(saveTrackedResponse(world.response, mixed));
    expect(error.code).toBe("invalid_answers");
    expect(error.questionIds).toEqual(["enjoy", "section"]);

    const youngOnTracked = trackedRequest(world, { answers: { "age-group": "young-person", section: "scouts", enjoy: 4, say: 3 } });
    expect((await rejection(saveTrackedResponse(world.response, youngOnTracked))).code).toBe("invalid_answers");

    const missing = trackedRequest(world, { answers: { "age-group": "adult", "adult-roles": ["volunteer"] } });
    expect((await rejection(saveTrackedResponse(world.response, missing))).questionIds).toEqual(["communication", "support", "time"]);
    expect(world.store.objects.size).toBe(0);
  });

  it("refuses a forged, expired or other-survey pass, an old survey version and another survey", async () => {
    const world = createWorld();
    const forged = trackedPass(world).replace(/.$/, (last) => (last === "A" ? "B" : "A"));
    expect((await rejection(saveTrackedResponse(world.response, trackedRequest(world, { trackedPass: forged })))).code).toBe("invalid_link");

    const expired = trackedPass(world, "L".repeat(43), Math.floor(world.clock.now.getTime() / 1000) - 1);
    expect((await rejection(saveTrackedResponse(world.response, trackedRequest(world, { trackedPass: expired })))).code).toBe("invalid_link");

    expect((await rejection(saveTrackedResponse(world.response, trackedRequest(world, { surveyVersion: `sha256:${"0".repeat(64)}` })))).code).toBe("version_changed");
    expect((await rejection(saveTrackedResponse(world.response, trackedRequest(world, { surveyId: "another-survey" })))).code).toBe("invalid_answers");
    expect(world.store.objects.size).toBe(0);
  });

  it("[G21] refuses tracked submissions when tracked links or the survey are switched off", async () => {
    for (const controls of [{ tracked: false }, { survey: false }]) {
      const world = createWorld();
      world.setControls(controls);
      expect((await rejection(saveTrackedResponse(world.response, trackedRequest(world)))).code).toBe("survey_closed");
    }

    const world = createWorld();
    world.setControls({ open: false });
    expect(await saveTrackedResponse(world.response, trackedRequest(world))).toEqual({ status: "saved" });
  });

  it("passes unexpected errors on so they are reported as unavailable", async () => {
    const world = createWorld();
    world.response.keys = async () => ({ ...world.keys.response, trackedPassPublicKey: undefined as never });
    await expect(saveTrackedResponse(world.response, trackedRequest(world))).rejects.toThrow(TypeError);
  });
});

describe("open-link responses", () => {
  const openRequest = (answers: Record<string, string | string[] | number>, submissionId = randomUUID()) => ({ surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId, turnstileToken: "token", answers });

  it("[G8] gives adults a receipt that expires an hour after closing", async () => {
    const world = createWorld();
    const result = await saveOpenResponse(world.response, openRequest({ "age-group": "adult", "adult-roles": ["parent"], "child-sections": ["cubs"], communication: 5, value: "yes" }));

    expect(result.status).toBe("saved");
    expect(result.receipt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}$/);
    expect(result.receiptExpiresAt).toBe("2027-03-31T23:59:00.000Z");
    expect(JSON.parse(world.store.objects.get(world.objects("intake/intake/answers/")[0]!)!).source).toBe("open");
  });

  it("[G14] gives young people no receipt, and marks their comments for the young people's review", async () => {
    const world = createWorld();
    const result = await saveOpenResponse(world.response, openRequest({ "age-group": "young-person", section: "explorers", enjoy: 4, say: 5, "young-comments": "More hikes" }));

    expect(result).toEqual({ status: "saved" });
    const comment = JSON.parse(world.store.objects.get(world.objects("intake/intake/comments/")[0]!)!);
    expect(comment).toMatchObject({ audience: "young-person", source: "open", text: "More hikes" });
  });

  it("a retry with the same submission ID keeps the first files", async () => {
    const world = createWorld();
    const submissionId = randomUUID();
    const answers = { "age-group": "young-person", section: "scouts", enjoy: 2, say: 1, "young-comments": "First" };
    await saveOpenResponse(world.response, openRequest(answers, submissionId));
    await saveOpenResponse(world.response, openRequest({ ...answers, "young-comments": "Second" }, submissionId));

    expect(world.objects("intake/intake/answers/")).toHaveLength(1);
    expect(JSON.parse(world.store.objects.get(world.objects("intake/intake/comments/")[0]!)!).text).toBe("First");
  });

  it("refuses rejected Turnstile tokens with a metric, and reports Turnstile outages as unavailable", async () => {
    const world = createWorld();
    world.setTurnstile("rejected");
    expect((await rejection(saveOpenResponse(world.response, openRequest({ "age-group": "young-person", section: "cubs", enjoy: 3, favourite: "games" })))).code).toBe("verification_failed");
    expect(world.metrics).toEqual(["TurnstileRejected"]);

    world.setTurnstile("unavailable");
    expect((await rejection(saveOpenResponse(world.response, openRequest({ "age-group": "young-person", section: "cubs", enjoy: 3, favourite: "games" })))).code).toBe("temporarily_unavailable");
    expect(world.store.objects.size).toBe(0);
  });

  it("[G21] accepts open submissions in the grace hour, then refuses them", async () => {
    const world = createWorld();
    const answers = { "age-group": "young-person", section: "cubs", enjoy: 3, favourite: "games" };
    world.clock.now = new Date("2027-03-31T23:30:00Z");
    expect((await saveOpenResponse(world.response, openRequest(answers))).status).toBe("saved");

    world.clock.now = new Date("2027-04-01T00:00:00Z");
    expect((await rejection(saveOpenResponse(world.response, openRequest(answers)))).code).toBe("survey_closed");

    world.clock.now = new Date("2027-02-28T12:00:00Z");
    expect((await rejection(saveOpenResponse(world.response, openRequest(answers)))).code).toBe("survey_closed");

    world.clock.now = new Date("2027-03-14T12:00:00Z");
    world.setControls({ open: false });
    expect((await rejection(saveOpenResponse(world.response, openRequest(answers)))).code).toBe("survey_closed");
  });
});

describe("response routes", () => {
  it("routes requests, refuses direct calls and bodies that do not match the contract", async () => {
    const world = createWorld();
    const routes = createResponseRoutes(world.response);
    const lambda = createResponseLambda(survey, { ...window, buildId: "build-1" }, async (name) => {
      if (name === "origin-header") return JSON.stringify([originValue]);
      throw new Error(`unexpected secret ${name}`);
    }, { store: world.store, intakeBucket: "intake", usedRecordsBucket: "used", controls: world.response.controls, metrics: world.response.metrics, now: world.response.now });

    const tracked = await routes[responseRoutes.tracked]!(apiEvent(responseRoutes.tracked, trackedRequest(world)));
    expect(tracked.result.statusCode).toBe(200);
    expect(tracked.source).toBe("tracked");

    const direct = await lambda(apiEvent(responseRoutes.open, {}, {}));
    expect(direct.statusCode).toBe(403);
    expect(JSON.parse(String(direct.body))).toEqual({ error: "verification_failed" });

    const malformed = await lambda(apiEvent(responseRoutes.open, "{not json"));
    expect([malformed.statusCode, JSON.parse(String(malformed.body))]).toEqual([422, { error: "invalid_answers" }]);

    const extra = await lambda(apiEvent(responseRoutes.open, { surveyId: survey.surveyId, ipAddress: "203.0.113.9" }));
    expect(extra.statusCode).toBe(422);

    const large = await lambda(apiEvent(responseRoutes.open, "x".repeat(70_000)));
    expect(large.statusCode).toBe(413);

    const unknown = await lambda(apiEvent("POST /api/v1/tracking/open", { token: "x" }));
    expect(unknown.statusCode).toBe(404);

    const failing = await lambda(apiEvent(responseRoutes.open, { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), turnstileToken: "t", answers: { "age-group": "adult", "adult-roles": ["network"], "network-activities": "rarely" } }));
    expect([failing.statusCode, JSON.parse(String(failing.body))]).toEqual([503, { error: "temporarily_unavailable" }]);
  });
});
