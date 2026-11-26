// Calls to the survey APIs. Failed connections and temporary errors are retried with the same
// submission ID, so a retry can never create a second response.
import type { Answers } from "@lbdistrictscouts/survey-engine";
import type { ErrorCode } from "@/lib/contracts/types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; questionIds?: string[] };

export type ApiOptions = {
  base?: string;
  fetcher?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  attempts?: number;
};

const retryable = new Set<ErrorCode>(["temporarily_unavailable", "rate_limited"]);
const errorCodes = new Set<string>(["survey_closed", "version_changed", "invalid_link", "already_completed", "invalid_answers", "verification_failed", "rate_limited", "temporarily_unavailable"]);

export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";

const delays = [1000, 3000, 8000];

/** Posts once. Any network failure or unreadable response counts as temporarily unavailable. */
export async function postOnce<T>(path: string, body: unknown, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const fetcher = options.fetcher ?? fetch;
  try {
    const response = await fetcher(`${options.base ?? apiBase}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return { ok: true, data: data as T };
    const code = typeof data?.error === "string" && errorCodes.has(data.error) ? (data.error as ErrorCode) : response.status === 429 ? "rate_limited" : "temporarily_unavailable";
    return { ok: false, code, questionIds: Array.isArray(data?.questionIds) ? data.questionIds : undefined };
  } catch {
    return { ok: false, code: "temporarily_unavailable" };
  }
}

/**
 * Posts with retries. `body` is called for each attempt, so an open-link retry can bring a new
 * Turnstile token while keeping everything else the same.
 */
export async function post<T>(path: string, body: () => Promise<unknown> | unknown, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const attempts = options.attempts ?? delays.length + 1;
  let result: ApiResult<T> = { ok: false, code: "temporarily_unavailable" };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await wait(delays[Math.min(attempt - 1, delays.length - 1)]!);
    result = await postOnce<T>(path, await body(), options);
    if (result.ok || !retryable.has(result.code)) return result;
  }
  return result;
}

export type OpenTrackedResult = { status: "ready"; trackedPass: string; closesAt: string } | { status: "completed"; resultsToken: string };

export const surveyApi = {
  openTrackedLink: (token: string, options?: ApiOptions) => post<OpenTrackedResult>("/api/v1/tracking/open", () => ({ token }), options),
  startTrackedLink: (token: string, options?: ApiOptions) => post<{ status: "ok" }>("/api/v1/tracking/start", () => ({ token }), options),
  completeTrackedLink: (token: string, options?: ApiOptions) => post<{ status: "completed"; resultsToken: string }>("/api/v1/tracking/complete", () => ({ token }), options),
  claimReceipt: (token: string, receipt: string, options?: ApiOptions) => post<{ status: "completed"; resultsToken: string }>("/api/v1/tracking/claim", () => ({ token, receipt }), options),
  declineTrackedLink: (token: string, options?: ApiOptions) => post<{ status: "ok" }>("/api/v1/tracking/decline", () => ({ token }), options),

  saveTrackedResponse: (request: { surveyId: string; surveyVersion: string; submissionId: string; retrySecretHash: string; trackedPass: string; answers: Answers }, options?: ApiOptions) =>
    post<{ status: "saved" }>("/api/v1/responses/tracked", () => request, options),

  saveOpenResponse: (request: { surveyId: string; surveyVersion: string; submissionId: string; answers: Answers }, turnstileToken: () => Promise<string>, options?: ApiOptions) =>
    post<{ status: "saved"; receipt?: string; receiptExpiresAt?: string }>("/api/v1/responses/open", async () => ({ ...request, turnstileToken: await turnstileToken() }), options),
};

/** The results site's access page, which exchanges the token for results cookies. */
export function resultsAccessUrl(resultsUrl: string, resultsToken: string): string {
  return `${resultsUrl.replace(/\/$/, "")}/access#token=${encodeURIComponent(resultsToken)}`;
}
