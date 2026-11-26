import { ApiError } from "../shared/http";
import { signEd25519 } from "../shared/signing";
import { passExpiry, requireOpen, windowState } from "../shared/survey-window";
import { checkLink, issueResultsToken, send, usedLinkKey, type TrackingDeps } from "./context";

export type OpenResult = { status: "ready"; trackedPass: string; closesAt: string } | { status: "completed"; resultsToken: string };

/**
 * Checks a tracked link. A link that has already saved a response resends `completed`, which
 * completes a task left open when the browser closed before `tracking/complete`.
 */
export async function openTrackedLink(deps: TrackingDeps, token: string): Promise<OpenResult> {
  const { uuid, linkRef, keys } = await checkLink(deps, token);

  if (await deps.store.exists(deps.usedRecordsBucket, usedLinkKey(linkRef))) {
    await send(deps, uuid, "completed");
    return { status: "completed", resultsToken: issueResultsToken(deps, keys) };
  }

  const now = deps.now();
  requireOpen(deps.window, await deps.controls(), "tracked", now);
  // The page stops offering the survey at closing, so no new passes are issued in the grace hour.
  if (windowState(deps.window, now) !== "open") throw new ApiError("survey_closed");

  const trackedPass = signEd25519(keys.trackedPassPrivateKey, { v: 1, s: deps.window.surveyId, l: linkRef, exp: passExpiry(deps.window) });
  return { status: "ready", trackedPass, closesAt: new Date(deps.window.closesAt).toISOString() };
}
