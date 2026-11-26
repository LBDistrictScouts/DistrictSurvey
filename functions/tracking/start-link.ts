import { requireOpen } from "../shared/survey-window";
import { checkLink, send, type TrackingDeps } from "./context";

/** The volunteer pressed Start, so their task moves to in_progress. */
export async function startLink(deps: TrackingDeps, token: string): Promise<{ status: "ok" }> {
  const { uuid } = await checkLink(deps, token);
  requireOpen(deps.window, await deps.controls(), "tracked", deps.now());
  await send(deps, uuid, "started");
  return { status: "ok" };
}
