import { ApiError } from "../shared/http";
import { SignedValueError, verifyResultsToken } from "../shared/signing";
import { nowSeconds, type TrackingDeps } from "./context";

// Cookies last 7 days, or until the results token expires if sooner.
export const cookieLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;

/** Exchanges a results token for results cookies. Nothing records who asked. */
export async function resultsAccess(deps: TrackingDeps, token: string): Promise<{ body: { status: "ok"; expiresAt: string }; cookies: string[] }> {
  const keys = await deps.keys();
  if (!(await deps.controls()).resultsCookies) throw new ApiError("temporarily_unavailable");

  let expiry: number;
  try {
    expiry = verifyResultsToken(keys.resultsTokenPublicKey, token, deps.window.surveyId, nowSeconds(deps)).exp;
  } catch (error) {
    if (error instanceof SignedValueError) throw new ApiError("invalid_link");
    throw error;
  }

  const expiresAt = new Date(Math.min(deps.now().getTime() + cookieLifetimeMilliseconds, expiry * 1000));
  return { body: { status: "ok", expiresAt: expiresAt.toISOString() }, cookies: await deps.signCookies(deps.window.surveyId, expiresAt) };
}
