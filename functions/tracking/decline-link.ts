import { ApiError } from "../shared/http";
import { requireOpen } from "../shared/survey-window";
import { checkLink, send, usedLinkKey, type TrackingDeps } from "./context";

/** Stops reminders. Opening the link again still lets the person take part. */
export async function declineLink(deps: TrackingDeps, token: string): Promise<{ status: "ok" }> {
  const { uuid, linkRef } = await checkLink(deps, token);
  requireOpen(deps.window, await deps.controls(), "tracked", deps.now());
  if (await deps.store.exists(deps.usedRecordsBucket, usedLinkKey(linkRef))) throw new ApiError("already_completed");
  await send(deps, uuid, "declined");
  return { status: "ok" };
}
