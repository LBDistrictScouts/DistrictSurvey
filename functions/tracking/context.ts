import type { KeyObject } from "node:crypto";
import { z } from "zod";
import type { ControlSource } from "../shared/controls";
import { ApiError } from "../shared/http";
import type { MetricSink } from "../shared/metrics";
import type { RecordStore } from "../shared/s3-records";
import { linkRef, signEd25519, SignedValueError, verifyTrackedLink } from "../shared/signing";
import { resultsExpiry, type SurveyWindow } from "../shared/survey-window";

export type TrackingKeys = {
  trackedLinkKey: Buffer;
  linkReferenceKey: Buffer;
  receiptRecordKey: Buffer;
  trackedPassPrivateKey: KeyObject;
  receiptPublicKey: KeyObject;
  resultsTokenPrivateKey: KeyObject;
  resultsTokenPublicKey: KeyObject;
};

/** A completion message, from contracts/schemas/completion-message.v1.json. It carries nothing else. */
export type CompletionMessage = {
  schemaVersion: "1.0";
  surveyId: string;
  inviteUuid: string;
  event: "started" | "completed" | "declined";
};

export type CookieSigner = (surveyId: string, expiresAt: Date) => Promise<string[]>;

export type TrackingDeps = {
  window: SurveyWindow;
  store: RecordStore;
  usedRecordsBucket: string;
  keys: () => Promise<TrackingKeys>;
  controls: ControlSource;
  sendCompletion: (message: CompletionMessage) => Promise<void>;
  signCookies: CookieSigner;
  metrics: MetricSink;
  now: () => Date;
};

export const tokenRequest = z.strictObject({ token: z.string().min(1).max(600) });

export type CheckedLink = { uuid: string; linkRef: string; keys: TrackingKeys };

/** Checks a tracked link token and works out its one-way link reference. */
export async function checkLink(deps: TrackingDeps, token: string): Promise<CheckedLink> {
  const keys = await deps.keys();
  try {
    const payload = verifyTrackedLink(keys.trackedLinkKey, token, deps.window.surveyId);
    return { uuid: payload.u, linkRef: linkRef(keys.linkReferenceKey, deps.window.surveyId, payload.u), keys };
  } catch (error) {
    if (error instanceof SignedValueError) throw new ApiError("invalid_link");
    throw error;
  }
}

/**
 * Sends one completion message. If the queue is unavailable the request fails, and the task is
 * completed later because every open of a used link resends `completed`.
 */
export async function send(deps: TrackingDeps, uuid: string, event: CompletionMessage["event"]): Promise<void> {
  try {
    await deps.sendCompletion({ schemaVersion: "1.0", surveyId: deps.window.surveyId, inviteUuid: uuid, event });
  } catch {
    await deps.metrics("CompletionSendFailed");
    throw new ApiError("temporarily_unavailable");
  }
}

export function usedLinkKey(ref: string): string {
  return `links/${ref}`;
}

/** A results token valid until 3 months after closing. */
export function issueResultsToken(deps: TrackingDeps, keys: TrackingKeys): string {
  return signEd25519(keys.resultsTokenPrivateKey, { v: 1, s: deps.window.surveyId, a: "volunteer", exp: Math.floor(resultsExpiry(deps.window).getTime() / 1000) });
}

export function nowSeconds(deps: TrackingDeps): number {
  return Math.floor(deps.now().getTime() / 1000);
}
