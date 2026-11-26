import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { retrySecretHash, saveOpenResponse, saveTrackedResponse } from "../../functions/response/save-response";
import { openTrackedLink } from "../../functions/tracking/open-tracked-link";
import { createWorld, survey, trackedLink, volunteerAnswers } from "./helpers";

const schema = (name: string) => JSON.parse(readFileSync(new URL(`../../contracts/schemas/${name}`, import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
for (const name of ["tracked-link.v1.json", "answer-file.v1.json", "comment-file.v1.json"]) ajv.addSchema(schema(name));

// The approved stored fields. Adding a field means changing the contract and this list together.
const approvedAnswerFields = ["answers", "schemaVersion", "source", "submissionId", "submittedOn", "surveyId", "surveyVersion"];
const approvedCommentFields = ["audience", "commentId", "questionId", "schemaVersion", "source", "submittedOn", "surveyId", "surveyVersion", "text"];

describe("stored fields", () => {
  it("[G6] the contract lists exactly the approved fields", () => {
    expect(Object.keys(schema("answer-file.v1.json").properties).sort()).toEqual(approvedAnswerFields);
    expect(Object.keys(schema("comment-file.v1.json").properties).sort()).toEqual(approvedCommentFields);
    expect(schema("answer-file.v1.json").additionalProperties).toBe(false);
    expect(schema("comment-file.v1.json").additionalProperties).toBe(false);
  });

  it("[G6] stored files hold only approved fields, with no UUID, link, pass, IP address or time of day", async () => {
    const world = createWorld();
    const uuid = randomUUID();
    const token = trackedLink(world.keys, uuid);
    const opened = await openTrackedLink(world.tracking, token);
    if (opened.status !== "ready") throw new Error("expected a pass");

    await saveTrackedResponse(world.response, { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), retrySecretHash: retrySecretHash("s"), trackedPass: opened.trackedPass, answers: { ...volunteerAnswers, "adult-comments": "A comment" } });
    await saveOpenResponse(world.response, { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), turnstileToken: "t", answers: { "age-group": "young-person", section: "scouts", enjoy: 1, say: 2, "young-comments": "Another" } });

    const validateAnswer = ajv.getSchema("https://github.com/LBDistrictScouts/DistrictSurvey/contracts/schemas/answer-file.v1.json")!;
    const validateComment = ajv.getSchema("https://github.com/LBDistrictScouts/DistrictSurvey/contracts/schemas/comment-file.v1.json")!;

    for (const [key, body] of world.store.objects) {
      if (!key.startsWith("intake/")) continue;
      const file = JSON.parse(body);
      const isAnswer = key.startsWith("intake/intake/answers/");
      expect(Object.keys(file).sort()).toEqual(isAnswer ? approvedAnswerFields : approvedCommentFields);
      expect((isAnswer ? validateAnswer : validateComment)(file), JSON.stringify((isAnswer ? validateAnswer : validateComment).errors)).toBe(true);

      for (const forbidden of [uuid, token, opened.trackedPass, "203.0.113", "T15:30", ":30:00"]) expect(body).not.toContain(forbidden);
    }

    for (const [key, body] of world.store.objects) {
      if (key.startsWith("used/")) expect(body).toMatch(/^([0-9a-f]{64}|receipt|[A-Za-z0-9_-]{43})$/);
      expect(key).not.toContain(uuid);
    }
  });
});
