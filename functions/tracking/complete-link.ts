import { ApiError } from "../shared/http";
import { checkLink, issueResultsToken, send, usedLinkKey, type TrackingDeps } from "./context";

/**
 * Called after the response Lambda saved the answers. The used-link record is the evidence: without
 * it nothing was saved for this link, so no completion is sent.
 */
export async function completeLink(deps: TrackingDeps, token: string): Promise<{ status: "completed"; resultsToken: string }> {
  const { uuid, linkRef, keys } = await checkLink(deps, token);
  if (!(await deps.store.exists(deps.usedRecordsBucket, usedLinkKey(linkRef)))) throw new ApiError("invalid_link");
  await send(deps, uuid, "completed");
  return { status: "completed", resultsToken: issueResultsToken(deps, keys) };
}
