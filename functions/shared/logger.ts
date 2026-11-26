import type { ErrorCode } from "./http";

/**
 * The only fields a Lambda may log. Each request writes one entry. Answers, tokens, invite UUIDs,
 * IP addresses, user agents and error messages are never logged. tests/functions/logging.test.ts
 * fails if another field appears.
 */
export const allowedLogFields = ["requestId", "route", "outcome", "failureCode", "responseTimeBand", "source", "surveyVersion", "buildId"] as const;

export type LogEntry = {
  requestId: string;
  route: string;
  outcome: "ok" | "error";
  failureCode?: ErrorCode | "internal";
  responseTimeBand: "<100ms" | "<500ms" | "<2s" | ">=2s";
  source?: "open" | "tracked";
  surveyVersion?: string;
  buildId: string;
};

export function responseTimeBand(milliseconds: number): LogEntry["responseTimeBand"] {
  if (milliseconds < 100) return "<100ms";
  if (milliseconds < 500) return "<500ms";
  if (milliseconds < 2000) return "<2s";
  return ">=2s";
}

type Writer = (line: string) => void;

let writer: Writer = (line) => console.log(line);

/** Replaces where log lines go. Tests use this to capture them. */
export function setLogWriter(next: Writer): void {
  writer = next;
}

export function writeLog(entry: LogEntry): void {
  const approved = Object.fromEntries(allowedLogFields.filter((field) => entry[field] !== undefined).map((field) => [field, entry[field]]));
  writer(JSON.stringify(approved));
}
