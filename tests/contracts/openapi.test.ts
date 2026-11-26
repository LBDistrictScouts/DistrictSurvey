import { randomUUID } from "node:crypto";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { createResponseLambda } from "../../functions/response/handler";
import { retrySecretHash } from "../../functions/response/save-response";
import { createTrackingLambda, trackingRoutes } from "../../functions/tracking/handler";
import { apiEvent, createWorld, secretSource, survey, trackedLink, volunteerAnswers, window } from "../functions/helpers";
import { contractAjv, openApi, root } from "./ajv";

const ajv = contractAjv();
const surveyApi = openApi("survey-api.v1.yaml");
const statisticsApi = openApi("statistics-api.v1.yaml");
ajv.addSchema(surveyApi, "survey-api.v1.yaml");
ajv.addSchema(statisticsApi, "statistics-api.v1.yaml");

function operation(path: string) {
  return surveyApi.paths[path].post;
}

function requestSchema(path: string) {
  const body = operation(path).requestBody;
  const content = body.$ref ? surveyApi.components.requestBodies[body.$ref.split("/").pop()].content : body.content;
  return ajv.compile(content["application/json"].schema);
}

function responseSchema(path: string, status: number) {
  let response = operation(path).responses[String(status)];
  if (response.$ref) response = surveyApi.components.responses[response.$ref.split("/").pop()];
  return ajv.compile(response.content["application/json"].schema);
}

function expectValid(validate: ReturnType<typeof ajv.compile>, value: unknown) {
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
}

describe("survey API contract", () => {
  it("lists a message, action and status for every error code", () => {
    const catalogue = surveyApi["x-error-catalogue"];
    expect(Object.keys(catalogue).sort()).toEqual([...surveyApi.components.schemas.ErrorCode.enum].sort());
    for (const entry of Object.values<{ message: string; action: string; status: number }>(catalogue)) {
      expect(entry.message.length).toBeGreaterThan(10);
      expect(entry.action.length).toBeGreaterThan(10);
    }
  });

  it("the OpenAPI request examples are valid requests", () => {
    for (const path of Object.keys(surveyApi.paths)) {
      const examples = operation(path).requestBody?.content?.["application/json"]?.examples ?? {};
      for (const example of Object.values<{ value: unknown }>(examples)) expectValid(requestSchema(path), example.value);
    }
  });

  it("[G5] [G7] real Lambda requests and responses match the contract", async () => {
    const world = createWorld();
    const secrets = secretSource(world.keys);
    const tracking = createTrackingLambda({ ...window, buildId: "b" }, secrets, world.tracking);
    const response = createResponseLambda(survey, { ...window, buildId: "b" }, secrets, { store: world.store, intakeBucket: "intake", usedRecordsBucket: "used", controls: world.response.controls, metrics: world.response.metrics, now: world.response.now });
    const token = trackedLink(world.keys);

    const call = async (lambda: typeof tracking, path: string, body: object, expectedStatus = 200, validRequest = true) => {
      if (validRequest) expectValid(requestSchema(path), body);
      const result = await lambda(apiEvent(`POST ${path}`, body));
      expect(result.statusCode).toBe(expectedStatus);
      expect(result.headers?.["cache-control"]).toBe("no-store");
      const parsed = JSON.parse(String(result.body));
      expectValid(responseSchema(path, expectedStatus), parsed);
      return parsed;
    };

    const opened = await call(tracking, "/api/v1/tracking/open", { token });
    await call(tracking, "/api/v1/tracking/start", { token });
    const answers = { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), retrySecretHash: retrySecretHash("s"), trackedPass: opened.trackedPass, answers: volunteerAnswers };
    await call(response, "/api/v1/responses/tracked", answers);
    await call(response, "/api/v1/responses/tracked", { ...answers, submissionId: randomUUID(), retrySecretHash: retrySecretHash("other") }, 409);
    const completed = await call(tracking, "/api/v1/tracking/complete", { token });
    await call(tracking, "/api/results-access", { token: completed.resultsToken });
    await call(tracking, "/api/v1/tracking/open", { token });

    const open = await call(response, "/api/v1/responses/open", { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), turnstileToken: "t", answers: { "age-group": "adult", "adult-roles": ["parent"], "child-sections": ["beavers"], communication: 3, value: "no" } });
    const other = trackedLink(world.keys);
    await call(tracking, "/api/v1/tracking/claim", { token: other, receipt: open.receipt });
    await call(tracking, "/api/v1/tracking/claim", { token: trackedLink(world.keys), receipt: open.receipt }, 409);
    await call(tracking, "/api/v1/tracking/decline", { token: trackedLink(world.keys) });
    await call(response, "/api/v1/responses/open", { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), turnstileToken: "t", answers: { "age-group": "adult" } }, 422);
    await call(tracking, "/api/v1/tracking/open", { token: "not.valid" }, 400, false);
    expect(trackingRoutes.open).toBe("POST /api/v1/tracking/open");
  });
});

describe("DistrictStatistics API contract", () => {
  it("every route in the design is defined, with a token scope", () => {
    const routes = Object.entries<Record<string, { "x-token"?: string }>>(statisticsApi.paths).flatMap(([path, methods]) => Object.entries(methods).filter(([method]) => method !== "parameters").map(([method, value]) => [`${method.toUpperCase()} ${path}`, value["x-token"]]));
    expect(routes.map(([route]) => route).sort()).toEqual([
      "DELETE /api/v1/surveys/{surveyId}/removals",
      "GET /api/v1/comments/{commentId}",
      "GET /api/v1/surveys/{surveyId}/analyst-data",
      "GET /api/v1/surveys/{surveyId}/build-data",
      "GET /api/v1/surveys/{surveyId}/comments",
      "GET /api/v1/surveys/{surveyId}/settings",
      "GET /api/v1/surveys/{surveyId}/versions",
      "POST /api/v1/comments/{commentId}/decision",
      "POST /api/v1/survey-imports/{batchId}",
      "POST /api/v1/surveys/{surveyId}/close-down-evidence",
      "POST /api/v1/surveys/{surveyId}/open",
      "POST /api/v1/surveys/{surveyId}/releases",
      "POST /api/v1/surveys/{surveyId}/removals",
      "POST /api/v1/surveys/{surveyId}/versions",
      "POST /api/v1/surveys/{surveyId}/versions/{versionNumber}/approve",
      "PUT /api/v1/comments/{commentId}/task",
      "PUT /api/v1/surveys/{surveyId}/settings",
    ]);
    for (const [route, token] of routes) expect(["import", "comments", "survey-admin", "build", "results-viewer"], route).toContain(token);
  });

  it("[G24] the example build data matches the build data schema", async () => {
    const { exampleBuildData } = await import("../../src/lib/config/build-data");
    const validate = ajv.compile({ $ref: "statistics-api.v1.yaml#/components/schemas/BuildData" });
    expectValid(validate, exampleBuildData());
  });

  it("uses example.org servers only", () => {
    for (const name of ["survey-api.v1.yaml", "statistics-api.v1.yaml"]) {
      const document = parse(readFileSync(new URL(`contracts/openapi/${name}`, root), "utf8"));
      for (const server of document.servers) expect(server.url).toMatch(/example\.org$/);
    }
  });
});
