import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { evaluateSurvey } from "@lbdistrictscouts/survey-engine";
import { ed25519PublicKey, hmacKey, linkRef, verifyReceipt, verifyResultsToken, verifyTrackedLink, verifyTrackedPass } from "../../functions/shared/signing";
import { exampleBuildData } from "../../src/lib/config/build-data";
import { contractAjv, readJson, root, validator } from "./ajv";

const ajv = contractAjv();

describe("file contracts", () => {
  it("[G6] example answer and comment files match their schemas, and the invalid ones do not", () => {
    const answers = readJson("contracts/examples/answer-files.json");
    const comments = readJson("contracts/examples/comment-files.json");
    const answer = validator(ajv, "answer-file.v1.json");
    const comment = validator(ajv, "comment-file.v1.json");

    for (const file of answers.files) expect(answer(file).valid, answer(file).errors).toBe(true);
    for (const file of comments.files) expect(comment(file).valid, comment(file).errors).toBe(true);
    for (const file of answers.invalid) expect(answer(file).valid).toBe(false);
    for (const file of comments.invalid) expect(comment(file).valid).toBe(false);
  });

  it("example answers follow the example survey's routing", () => {
    const { compiled } = exampleBuildData();
    for (const file of readJson("contracts/examples/answer-files.json").files) {
      const evaluation = evaluateSurvey(compiled, file.answers, [`source:${file.source}`]);
      expect(evaluation.errors).toEqual([]);
      expect(evaluation.staleAnswers).toEqual([]);
      expect(file.surveyVersion).toBe(compiled.fingerprint);
    }
  });

  it("[G23] each archive line is an import record, in an order unrelated to submission", () => {
    const lines = readFileSync(new URL("contracts/examples/archive.jsonl", root), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const record = validator(ajv, "import-request.v1.json#/$defs/record");
    for (const line of lines) expect(record(line).valid, record(line).errors).toBe(true);
    expect(lines.map((line) => line.kind)).toEqual(["comment", "answer", "answer", "comment", "answer"]);

    const checksum = validator(ajv, "archive.v1.json#/$defs/checksum");
    expect(checksum(createHash("sha256").update(readFileSync(new URL("contracts/examples/archive.jsonl", root))).digest("hex")).valid).toBe(true);
    const key = validator(ajv, "archive.v1.json#/$defs/key");
    expect(key("archive/example-2027/2f1e0d9c-8b7a-4c6d-9e5f-4a3b2c1d0e9f.jsonl.gz").valid).toBe(true);
    expect(key("archive/example-2027/2f1e0d9c-8b7a-4c6d-9e5f-4a3b2c1d0e9f.sha256").valid).toBe(true);
    expect(key("archive/example-2027/2027-03-14T15:30.jsonl.gz").valid).toBe(false);
  });

  it("[G5] completion messages carry only the survey, invite UUID and event", () => {
    const message = validator(ajv, "completion-message.v1.json");
    expect(message({ schemaVersion: "1.0", surveyId: "example-2027", inviteUuid: "6f1c2a9e-4b7d-4e3a-9c5f-2d8b1a7e3f60", event: "completed" }).valid).toBe(true);
    expect(message({ schemaVersion: "1.0", surveyId: "example-2027", inviteUuid: "6f1c2a9e-4b7d-4e3a-9c5f-2d8b1a7e3f60", event: "completed", at: "2027-03-14T15:30:00Z" }).valid).toBe(false);
    expect(message({ schemaVersion: "1.0", surveyId: "example-2027", inviteUuid: "6f1c2a9e-4b7d-4e3a-9c5f-2d8b1a7e3f60", event: "viewed" }).valid).toBe(false);
  });

  it("intake and used-record keys are one-way names", () => {
    const keys = validator(ajv, "intake-keys.v1.json");
    for (const key of [`intake/answers/${"a".repeat(43)}.json`, `intake/comments/${"b".repeat(43)}.json`, `links/${"c".repeat(43)}`, `receipts/${"d".repeat(43)}`]) expect(keys(key).valid, key).toBe(true);
    for (const key of ["intake/answers/0b6f1d3a-2c4e-4a9b-8f7e-1d2c3b4a5e6f.json", `links/${"c".repeat(42)}`, `other/${"d".repeat(43)}`]) expect(keys(key).valid, key).toBe(false);
  });

  it("control parameter names and values, and metric names, match the contracts", () => {
    const name = validator(ajv, "controls.v1.json#/$defs/name");
    expect(name("/district-survey/prod/controls/results-cookies").valid).toBe(true);
    expect(name("/district-survey/staging/controls/open").valid).toBe(false);
    const metric = validator(ajv, "metrics.v1.json");
    expect(metric({ namespace: "DistrictSurvey/test", name: "TurnstileRejected", value: 1, unit: "Count" }).valid).toBe(true);
    expect(metric({ namespace: "DistrictSurvey/test", name: "SomethingElse", value: 1, unit: "Count" }).valid).toBe(false);
  });

  it("[G10] the worked signed-value examples verify with the published example keys", () => {
    const examples = readJson("contracts/examples/signed-values.json");
    const survey = "example-2027";
    const before = Math.floor(Date.UTC(2027, 2, 14) / 1000);

    expect(validator(ajv, "tracked-link.v1.json")({ url: examples.trackedLink.url, token: examples.trackedLink.token, payload: examples.trackedLink.payload }).valid).toBe(true);
    expect(verifyTrackedLink(hmacKey(examples.keys.trackedLinkKey), examples.trackedLink.token, survey)).toEqual(examples.trackedLink.payload);
    expect(linkRef(hmacKey(examples.keys.linkReferenceKey), survey, examples.trackedLink.payload.u)).toBe(examples.trackedLink.linkRef);
    expect(verifyTrackedPass(ed25519PublicKey(examples.keys.trackedPassPublicKey), examples.trackedPass.value, survey, before)).toEqual(examples.trackedPass.payload);
    expect(verifyReceipt(ed25519PublicKey(examples.keys.receiptPublicKey), examples.receipt.value, survey, before)).toEqual(examples.receipt.payload);
    expect(verifyResultsToken(ed25519PublicKey(examples.keys.resultsTokenPublicKey), examples.resultsToken.value, survey, before)).toEqual(examples.resultsToken.payload);

    for (const [ref, value] of [["signed-values.v1.json#/$defs/trackedPass", examples.trackedPass.payload], ["signed-values.v1.json#/$defs/receipt", examples.receipt.payload], ["signed-values.v1.json#/$defs/resultsToken", examples.resultsToken.payload]] as const) {
      expect(validator(ajv, ref)(value).valid).toBe(true);
    }
    for (const value of [examples.trackedPass.value, examples.receipt.value, examples.resultsToken.value]) expect(validator(ajv, "signed-values.v1.json#/$defs/signedValue")(value).valid).toBe(true);
  });

  it("[G11] [G12] every expected release group in the reviewed results examples matches the release schema", () => {
    const group = validator(ajv, "results-release.v1.json#/$defs/group");
    for (const name of ["minimums", "steps", "removals"]) {
      for (const testCase of readJson(`contracts/examples/results/${name}.json`).cases) {
        for (const step of testCase.steps) {
          if (!step.expected.published) continue;
          for (const value of step.expected.groups) {
            expect(group(value).valid, `${name}: ${group(value).errors}`).toBe(true);
            if (!value.hidden) expect(value.shownCount % 3).toBe(0);
          }
        }
      }
    }
  });

  it("a results release document matches its schema", () => {
    const release = validator(ajv, "results-release.v1.json");
    const groups = readJson("contracts/examples/results/minimums.json").cases[1].steps[0].expected.groups;
    expect(release({ schemaVersion: "1.0", surveyId: "example-2027", releaseId: "20270303T0900Z-a1b2c3", generatedAt: "2027-03-03T09:00:00Z", final: false, questions: [{ questionId: "support", type: "scale", groups }] }).valid).toBe(true);
    expect(release({ schemaVersion: "1.0", surveyId: "example-2027", releaseId: "x", generatedAt: "2027-03-03T09:00:00Z", final: false, questions: [] }).valid).toBe(false);
  });
});
