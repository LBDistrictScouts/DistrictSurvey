import { z } from "zod";
import { ApiError } from "../shared/http";
import { hmacName, SignedValueError, verifyReceipt } from "../shared/signing";
import { requireOpen } from "../shared/survey-window";
import { checkLink, issueResultsToken, nowSeconds, send, usedLinkKey, type TrackingDeps } from "./context";

export const claimRequest = z.strictObject({ token: z.string().min(1).max(600), receipt: z.string().min(1).max(600) });

export function usedReceiptKey(receiptRecordKey: Buffer, receiptId: string): string {
  return `receipts/${hmacName(receiptRecordKey, receiptId)}`;
}

/**
 * Completes a tracked link with an open-link receipt, after the person confirmed they already responded.
 * The receipt record holds the link reference it completed, so repeating the same claim succeeds and
 * using the receipt for a different link fails.
 */
export async function claimReceipt(deps: TrackingDeps, token: string, receipt: string): Promise<{ status: "completed"; resultsToken: string }> {
  const { uuid, linkRef, keys } = await checkLink(deps, token);

  let receiptId: string;
  try {
    receiptId = verifyReceipt(keys.receiptPublicKey, receipt, deps.window.surveyId, nowSeconds(deps)).r;
  } catch (error) {
    if (error instanceof SignedValueError) throw new ApiError("invalid_link");
    throw error;
  }

  const linkKey = usedLinkKey(linkRef);
  if (!(await deps.store.exists(deps.usedRecordsBucket, linkKey))) {
    requireOpen(deps.window, await deps.controls(), "tracked", deps.now());

    const receiptKey = usedReceiptKey(keys.receiptRecordKey, receiptId);
    if ((await deps.store.putIfAbsent(deps.usedRecordsBucket, receiptKey, linkRef)) === "exists") {
      if ((await deps.store.get(deps.usedRecordsBucket, receiptKey)) !== linkRef) throw new ApiError("already_completed");
    }

    await deps.store.putIfAbsent(deps.usedRecordsBucket, linkKey, "receipt");
  }

  await send(deps, uuid, "completed");
  return { status: "completed", resultsToken: issueResultsToken(deps, keys) };
}
