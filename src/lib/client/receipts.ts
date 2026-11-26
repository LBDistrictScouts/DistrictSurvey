// The receipt from an adult's open-link response. A tracked link opened later on this device can use
// it, after the person confirms they already responded.
import { local, readJson, writeJson, type KeyValueStore } from "./storage";

export type StoredReceipt = { receipt: string; expiresAt: string };

export function receiptKey(surveyId: string): string {
  return `district-survey:${surveyId}:receipt`;
}

export function saveReceipt(surveyId: string, receipt: string, expiresAt: string, store: KeyValueStore = local): void {
  writeJson(store, receiptKey(surveyId), { receipt, expiresAt });
}

/** The stored receipt, if it has not expired. An expired receipt is removed. */
export function loadReceipt(surveyId: string, now = Date.now(), store: KeyValueStore = local): StoredReceipt | undefined {
  const stored = readJson<StoredReceipt>(store, receiptKey(surveyId));
  if (!stored) return undefined;
  if (!stored.receipt || !(Date.parse(stored.expiresAt) > now)) {
    store.removeItem(receiptKey(surveyId));
    return undefined;
  }
  return stored;
}

export function clearReceipt(surveyId: string, store: KeyValueStore = local): void {
  store.removeItem(receiptKey(surveyId));
}
