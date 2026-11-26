import { randomUUID } from "node:crypto";
import { ApiError } from "../../functions/shared/http";
import { signEd25519, signHmac, verifyResultsToken, verifyTrackedPass } from "../../functions/shared/signing";
import { retrySecretHash, saveOpenResponse, saveTrackedResponse } from "../../functions/response/save-response";
import { claimReceipt, usedReceiptKey } from "../../functions/tracking/claim-receipt";
import { completeLink } from "../../functions/tracking/complete-link";
import { declineLink } from "../../functions/tracking/decline-link";
import { createTrackingLambda, createTrackingRoutes, trackingRoutes } from "../../functions/tracking/handler";
import { openTrackedLink } from "../../functions/tracking/open-tracked-link";
import { resultsAccess } from "../../functions/tracking/results-access";
import { startLink } from "../../functions/tracking/start-link";
import { apiEvent, createWorld, originValue, survey, trackedLink, volunteerAnswers, window, type World } from "./helpers";

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the request to be rejected");
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

async function respondTracked(world: World, token: string) {
  const opened = await openTrackedLink(world.tracking, token);
  if (opened.status !== "ready") throw new Error("expected a pass");
  await saveTrackedResponse(world.response, { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), retrySecretHash: retrySecretHash("s"), trackedPass: opened.trackedPass, answers: volunteerAnswers });
}

async function openReceipt(world: World): Promise<string> {
  const result = await saveOpenResponse(world.response, { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), turnstileToken: "t", answers: { "age-group": "adult", "adult-roles": ["network"], "network-activities": "monthly" } });
  return result.receipt!;
}

describe("tracked link flow", () => {
  it("[G5] opens with a pass, sends started, then completed with a results token", async () => {
    const world = createWorld();
    const uuid = randomUUID();
    const token = trackedLink(world.keys, uuid);

    const opened = await openTrackedLink(world.tracking, token);
    expect(opened.status).toBe("ready");
    if (opened.status !== "ready") return;
    const pass = verifyTrackedPass(world.keys.trackedPass.publicKey, opened.trackedPass, survey.surveyId, seconds(world.clock.now));
    expect(pass.exp).toBe(seconds(new Date("2027-03-31T23:59:00Z")));
    expect(opened.closesAt).toBe("2027-03-31T22:59:00.000Z");

    expect(await startLink(world.tracking, token)).toEqual({ status: "ok" });
    await saveTrackedResponse(world.response, { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), retrySecretHash: retrySecretHash("s"), trackedPass: opened.trackedPass, answers: volunteerAnswers });

    const completed = await completeLink(world.tracking, token);
    expect(completed.status).toBe("completed");
    const resultsToken = verifyResultsToken(world.keys.results.publicKey, completed.resultsToken, survey.surveyId, seconds(world.clock.now));
    expect(new Date(resultsToken.exp * 1000).toISOString()).toBe("2027-06-30T22:59:00.000Z");

    expect(world.messages).toEqual([
      { schemaVersion: "1.0", surveyId: survey.surveyId, inviteUuid: uuid, event: "started" },
      { schemaVersion: "1.0", surveyId: survey.surveyId, inviteUuid: uuid, event: "completed" },
    ]);
  });

  it("[G5] reopening a used link resends completed, even after the survey closes", async () => {
    const world = createWorld();
    const token = trackedLink(world.keys);
    await respondTracked(world, token);

    world.clock.now = new Date("2027-05-01T12:00:00Z");
    const reopened = await openTrackedLink(world.tracking, token);
    expect(reopened.status).toBe("completed");
    expect(world.messages.map((message) => message.event)).toEqual(["completed"]);
  });

  it("[G5] complete refuses a link whose response was not saved", async () => {
    const world = createWorld();
    expect((await rejection(completeLink(world.tracking, trackedLink(world.keys)))).code).toBe("invalid_link");
    expect(world.messages).toEqual([]);
  });

  it("[G5] reports a failed completion send with a metric and an error", async () => {
    const world = createWorld();
    world.setQueueAvailable(false);
    expect((await rejection(startLink(world.tracking, trackedLink(world.keys)))).code).toBe("temporarily_unavailable");
    expect(world.metrics).toEqual(["CompletionSendFailed"]);
  });

  it("refuses forged links, links for another survey and wrongly signed links", async () => {
    const world = createWorld();
    const other = createWorld();
    const forged = [
      trackedLink(other.keys),
      trackedLink(world.keys, randomUUID(), "another-survey"),
      signHmac(world.keys.tracking.trackedLinkKey, { v: 2, s: survey.surveyId, u: randomUUID() }),
      signHmac(world.keys.tracking.trackedLinkKey, { v: 1, s: survey.surveyId, u: "not-a-uuid" }),
      "not.a-token",
    ];
    for (const token of forged) expect((await rejection(openTrackedLink(world.tracking, token))).code).toBe("invalid_link");
  });

  it("[G21] issues no new passes after closing or when tracked links are closed", async () => {
    const world = createWorld();
    world.clock.now = new Date("2027-03-31T23:10:00Z");
    expect((await rejection(openTrackedLink(world.tracking, trackedLink(world.keys)))).code).toBe("survey_closed");

    const closed = createWorld();
    closed.setControls({ tracked: false });
    expect((await rejection(openTrackedLink(closed.tracking, trackedLink(closed.keys)))).code).toBe("survey_closed");
  });

  it("passes unexpected errors on", async () => {
    const world = createWorld();
    world.tracking.keys = async () => ({ ...world.keys.tracking, trackedLinkKey: undefined as never });
    await expect(openTrackedLink(world.tracking, trackedLink(world.keys))).rejects.toThrow();
  });
});

describe("open-link receipts", () => {
  it("[G8] a receipt completes one tracked link, and repeating the claim succeeds", async () => {
    const world = createWorld();
    const receipt = await openReceipt(world);
    const uuid = randomUUID();
    const token = trackedLink(world.keys, uuid);

    const claimed = await claimReceipt(world.tracking, token, receipt);
    expect(claimed.status).toBe("completed");
    expect(world.store.objects.get(`used/links/${(await import("../../functions/shared/signing")).linkRef(world.keys.tracking.linkReferenceKey, survey.surveyId, uuid)}`)).toBe("receipt");

    expect((await claimReceipt(world.tracking, token, receipt)).status).toBe("completed");
    expect(world.messages.map((message) => message.inviteUuid)).toEqual([uuid, uuid]);
    expect(world.objects("intake/intake/answers/")).toHaveLength(1);
  });

  it("[G8] a used receipt cannot complete a second tracked link", async () => {
    const world = createWorld();
    const receipt = await openReceipt(world);
    await claimReceipt(world.tracking, trackedLink(world.keys), receipt);

    expect((await rejection(claimReceipt(world.tracking, trackedLink(world.keys), receipt))).code).toBe("already_completed");
    expect(world.messages).toHaveLength(1);
  });

  it("[G8] a retried claim whose receipt record was written finishes the link", async () => {
    const world = createWorld();
    const receipt = await openReceipt(world);
    const uuid = randomUUID();
    const { linkRef } = await import("../../functions/shared/signing");
    const ref = linkRef(world.keys.tracking.linkReferenceKey, survey.surveyId, uuid);
    const receiptId = JSON.parse(Buffer.from(receipt.split(".")[0]!, "base64url").toString()).r;
    world.store.objects.set(`used/${usedReceiptKey(world.keys.tracking.receiptRecordKey, receiptId)}`, ref);

    expect((await claimReceipt(world.tracking, trackedLink(world.keys, uuid), receipt)).status).toBe("completed");
  });

  it("[G8] a link that already has a response is completed without using the receipt", async () => {
    const world = createWorld();
    const token = trackedLink(world.keys);
    await respondTracked(world, token);
    const receipt = await openReceipt(world);

    expect((await claimReceipt(world.tracking, token, receipt)).status).toBe("completed");
    expect(world.objects("used/receipts/")).toEqual([]);
  });

  it("[G8] refuses forged or expired receipts", async () => {
    const world = createWorld();
    const exp = seconds(world.clock.now) + 60;
    const forged = signEd25519(createWorld().keys.receipt.privateKey, { v: 1, s: survey.surveyId, r: "r".repeat(22), exp });
    const expired = signEd25519(world.keys.receipt.privateKey, { v: 1, s: survey.surveyId, r: "r".repeat(22), exp: seconds(world.clock.now) });

    for (const receipt of [forged, expired, "x.y"]) expect((await rejection(claimReceipt(world.tracking, trackedLink(world.keys), receipt))).code).toBe("invalid_link");
    expect(world.messages).toEqual([]);
  });

  it("passes unexpected receipt errors on", async () => {
    const world = createWorld();
    world.tracking.keys = async () => ({ ...world.keys.tracking, receiptPublicKey: undefined as never });
    await expect(claimReceipt(world.tracking, trackedLink(world.keys), await openReceipt(world))).rejects.toThrow();
  });
});

describe("declining", () => {
  it("sends declined, and a declined link can still be opened and answered", async () => {
    const world = createWorld();
    const uuid = randomUUID();
    const token = trackedLink(world.keys, uuid);

    expect(await declineLink(world.tracking, token)).toEqual({ status: "ok" });
    expect(world.messages).toEqual([{ schemaVersion: "1.0", surveyId: survey.surveyId, inviteUuid: uuid, event: "declined" }]);
    expect((await openTrackedLink(world.tracking, token)).status).toBe("ready");
  });

  it("refuses to decline a completed link", async () => {
    const world = createWorld();
    const token = trackedLink(world.keys);
    await respondTracked(world, token);
    expect((await rejection(declineLink(world.tracking, token))).code).toBe("already_completed");
  });
});

describe("results access", () => {
  it("[G10] exchanges a results token for cookies lasting 7 days", async () => {
    const world = createWorld();
    const token = trackedLink(world.keys);
    await respondTracked(world, token);
    const { resultsToken } = await completeLink(world.tracking, token);

    const access = await resultsAccess(world.tracking, resultsToken);
    expect(access.body).toEqual({ status: "ok", expiresAt: "2027-03-21T15:30:00.000Z" });
    expect(access.cookies).toEqual([`CloudFront-Policy=${survey.surveyId}; Expires=Sun, 21 Mar 2027 15:30:00 GMT`]);
  });

  it("[G10] cookies end when the results token expires, and expired tokens issue no cookies", async () => {
    const world = createWorld();
    const exp = seconds(new Date("2027-06-30T22:59:00Z"));
    const token = signEd25519(world.keys.results.privateKey, { v: 1, s: survey.surveyId, a: "volunteer", exp });

    world.clock.now = new Date("2027-06-28T12:00:00Z");
    expect((await resultsAccess(world.tracking, token)).body.expiresAt).toBe("2027-06-30T22:59:00.000Z");

    world.clock.now = new Date("2027-07-01T00:00:00Z");
    expect((await rejection(resultsAccess(world.tracking, token))).code).toBe("invalid_link");
  });

  it("[G10] the results-cookies control stops cookie issue, and forged tokens are refused", async () => {
    const world = createWorld();
    const token = signEd25519(world.keys.results.privateKey, { v: 1, s: survey.surveyId, a: "volunteer", exp: seconds(world.clock.now) + 60 });
    world.setControls({ resultsCookies: false });
    expect((await rejection(resultsAccess(world.tracking, token))).code).toBe("temporarily_unavailable");

    world.setControls({});
    const forged = signEd25519(createWorld().keys.results.privateKey, { v: 1, s: survey.surveyId, a: "volunteer", exp: seconds(world.clock.now) + 60 });
    expect((await rejection(resultsAccess(world.tracking, forged))).code).toBe("invalid_link");

    world.tracking.keys = async () => ({ ...world.keys.tracking, resultsTokenPublicKey: undefined as never });
    await expect(resultsAccess(world.tracking, token)).rejects.toThrow();
  });
});

describe("tracking routes", () => {
  it("routes every tracking request and sets cookies on results access", async () => {
    const world = createWorld();
    const routes = createTrackingRoutes(world.tracking);
    const token = trackedLink(world.keys);

    expect((await routes[trackingRoutes.open]!(apiEvent(trackingRoutes.open, { token }))).result.statusCode).toBe(200);
    expect((await routes[trackingRoutes.start]!(apiEvent(trackingRoutes.start, { token }))).result.statusCode).toBe(200);
    expect((await routes[trackingRoutes.decline]!(apiEvent(trackingRoutes.decline, { token }))).result.statusCode).toBe(200);
    const receipt = await openReceipt(world);
    const claimed = await routes[trackingRoutes.claim]!(apiEvent(trackingRoutes.claim, { token, receipt }));
    expect(claimed.result.statusCode).toBe(200);
    expect((await routes[trackingRoutes.complete]!(apiEvent(trackingRoutes.complete, { token }))).result.statusCode).toBe(200);

    const resultsToken = JSON.parse(String(claimed.result.body)).resultsToken;
    const access = await routes[trackingRoutes.resultsAccess]!(apiEvent(trackingRoutes.resultsAccess, { token: resultsToken }));
    expect(access.result.cookies).toHaveLength(1);
  });

  it("builds the Lambda with origin checks", async () => {
    const world = createWorld();
    const lambda = createTrackingLambda({ ...window, buildId: "build-1" }, async () => JSON.stringify([originValue]), world.tracking);
    const result = await lambda(apiEvent(trackingRoutes.open, { token: trackedLink(world.keys) }, { "x-origin-verify": "wrong" }));
    expect(result.statusCode).toBe(403);
    const bad = await lambda(apiEvent(trackingRoutes.open, { token: 42 }));
    expect([bad.statusCode, JSON.parse(String(bad.body))]).toEqual([400, { error: "invalid_link" }]);
  });
});
