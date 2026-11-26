import { randomUUID } from "node:crypto";
import { allowedLogFields, responseTimeBand, setLogWriter, writeLog, type LogEntry } from "../../functions/shared/logger";
import { createResponseLambda } from "../../functions/response/handler";
import { createTrackingLambda, trackingRoutes } from "../../functions/tracking/handler";
import { retrySecretHash } from "../../functions/response/save-response";
import { apiEvent, createWorld, secretSource, survey, trackedLink, volunteerAnswers, window } from "./helpers";

describe("logging", () => {
  let lines: string[] = [];

  beforeEach(() => {
    lines = [];
    setLogWriter((line) => lines.push(line));
  });

  afterEach(() => setLogWriter((line) => console.log(line)));

  it("drops any field that is not approved", () => {
    writeLog({ requestId: "r", route: "x", outcome: "ok", responseTimeBand: "<100ms", buildId: "b", inviteUuid: "secret" } as LogEntry);
    expect(Object.keys(JSON.parse(lines[0]!))).toEqual(["requestId", "route", "outcome", "responseTimeBand", "buildId"]);
  });

  it("bands response times", () => {
    expect([0, 99, 100, 499, 500, 1999, 2000].map(responseTimeBand)).toEqual(["<100ms", "<100ms", "<500ms", "<500ms", "<2s", "<2s", ">=2s"]);
  });

  it("[G6] every request writes one entry with approved fields only, and never answers or tokens", async () => {
    const world = createWorld();
    const secrets = secretSource(world.keys);
    const tracking = createTrackingLambda({ ...window, buildId: "build-7" }, secrets, world.tracking);
    const response = createResponseLambda(survey, { ...window, buildId: "build-7" }, secrets, { store: world.store, intakeBucket: "intake", usedRecordsBucket: "used", controls: world.response.controls, metrics: world.response.metrics, now: world.response.now });

    const uuid = randomUUID();
    const token = trackedLink(world.keys, uuid);
    const opened = JSON.parse(String((await tracking(apiEvent(trackingRoutes.open, { token }))).body));
    await tracking(apiEvent(trackingRoutes.start, { token }));
    await response(apiEvent("POST /api/v1/responses/tracked", { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), retrySecretHash: retrySecretHash("s"), trackedPass: opened.trackedPass, answers: { ...volunteerAnswers, "adult-comments": "private words" } }));
    await tracking(apiEvent(trackingRoutes.complete, { token }, {}));
    await tracking(apiEvent(trackingRoutes.claim, { token, receipt: "bad" }));

    expect(lines).toHaveLength(5);
    for (const line of lines) {
      const entry = JSON.parse(line);
      expect(Object.keys(entry).every((key) => (allowedLogFields as readonly string[]).includes(key))).toBe(true);
      for (const forbidden of [uuid, token, opened.trackedPass, "private words", "203.0.113.9", "volunteer"]) expect(line).not.toContain(forbidden);
    }
    expect(lines.map((line) => JSON.parse(line).failureCode)).toEqual([undefined, undefined, undefined, "verification_failed", "invalid_link"]);
    expect(JSON.parse(lines[0]!)).toMatchObject({ route: trackingRoutes.open, outcome: "ok", source: "tracked", buildId: "build-7" });
  });
});
