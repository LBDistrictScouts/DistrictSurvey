import { timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { z } from "zod";
import { writeLog, responseTimeBand, type LogEntry } from "./logger";

export type ErrorCode =
  | "survey_closed"
  | "version_changed"
  | "invalid_link"
  | "already_completed"
  | "invalid_answers"
  | "verification_failed"
  | "rate_limited"
  | "temporarily_unavailable";

// Status codes from x-error-catalogue in contracts/openapi/survey-api.v1.yaml.
export const errorStatus: Record<ErrorCode, number> = {
  survey_closed: 409,
  version_changed: 409,
  invalid_link: 400,
  already_completed: 409,
  invalid_answers: 422,
  verification_failed: 403,
  rate_limited: 429,
  temporarily_unavailable: 503,
};

/** An expected failure. Its code is returned to the browser and logged; nothing else about it is. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly questionIds?: string[];

  constructor(code: ErrorCode, questionIds?: string[], status = errorStatus[code]) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.questionIds = questionIds;
  }
}

export const originHeaderName = "x-origin-verify";
export const maxBodyBytes = 64 * 1024;

export type Result = APIGatewayProxyStructuredResultV2;
export type Event = APIGatewayProxyEventV2;

export function json(status: number, body: object, cookies?: string[]): Result {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    body: JSON.stringify(body),
    ...(cookies ? { cookies } : {}),
  };
}

export function errorResult(error: ApiError): Result {
  return json(error.status, error.questionIds ? { error: error.code, questionIds: error.questionIds } : { error: error.code });
}

function header(event: Event, name: string): string | undefined {
  // API Gateway HTTP APIs lower-case header names.
  return event.headers?.[name];
}

/** Refuses requests that did not come through CloudFront, which adds a secret header. */
export function checkOrigin(event: Event, accepted: readonly string[]): void {
  const presented = Buffer.from(header(event, originHeaderName) ?? "");
  const match = accepted.some((value) => {
    const expected = Buffer.from(value);
    return value.length > 0 && expected.length === presented.length && timingSafeEqual(expected, presented);
  });
  if (!match) throw new ApiError("verification_failed");
}

/** Reads a JSON body no larger than 64 KiB and checks it against a schema. */
export function readBody<T extends z.ZodType>(event: Event, schema: T, failure: ErrorCode): z.output<T> {
  const raw = event.body ?? "";
  const text = event.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;

  if (Buffer.byteLength(text) > maxBodyBytes) throw new ApiError(failure, undefined, 413);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(failure);
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(failure);
  return parsed.data;
}

export type RouteOutcome = { result: Result; source?: LogEntry["source"]; surveyVersion?: string };

export type Route = (event: Event) => Promise<RouteOutcome>;

/**
 * Runs one route and writes exactly one log entry with the approved fields. Unexpected errors are
 * reported as temporarily_unavailable and logged as `internal`, without their message.
 */
export function createHandler(routes: Record<string, Route>, buildId: string, acceptedOrigins: () => Promise<readonly string[]>, now: () => number = Date.now) {
  return async (event: Event): Promise<Result> => {
    const started = now();
    const route = event.routeKey;
    const entry: LogEntry = { requestId: event.requestContext?.requestId ?? "unknown", route, outcome: "ok", responseTimeBand: "<100ms", buildId };
    let result: Result;

    try {
      checkOrigin(event, await acceptedOrigins());
      const handler = routes[route];
      if (!handler) throw new ApiError("invalid_link", undefined, 404);
      const outcome = await handler(event);
      result = outcome.result;
      if (outcome.source) entry.source = outcome.source;
      if (outcome.surveyVersion) entry.surveyVersion = outcome.surveyVersion;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError("temporarily_unavailable");
      result = errorResult(apiError);
      entry.outcome = "error";
      entry.failureCode = error instanceof ApiError ? apiError.code : "internal";
    }

    entry.responseTimeBand = responseTimeBand(now() - started);
    writeLog(entry);
    return result;
  };
}
