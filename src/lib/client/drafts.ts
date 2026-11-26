// Unfinished answers stay in this browser and are never sent until the person submits. Adult drafts
// last 7 days in local storage; young people's drafts last only for the tab session.
import type { Answers } from "@lbdistrictscouts/survey-engine";
import { local, readJson, session, writeJson, type KeyValueStore } from "./storage";

export type SurveyMode = "open" | "tracked";

export type Draft = {
  version: 1;
  surveyId: string;
  fingerprint: string;
  mode: SurveyMode;
  answers: Answers;
  submissionId: string;
  retrySecret: string;
  savedAt: number;
  trackedPass?: string;
  passExpiresAt?: string;
};

export const draftLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;

export type DraftStores = { local: KeyValueStore; session: KeyValueStore };

const browserStores: DraftStores = { local, session };

export function draftKey(surveyId: string, mode: SurveyMode): string {
  return `district-survey:${surveyId}:${mode}:draft`;
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A new draft with a fresh submission ID and retry secret. Both are reused for every retry. */
export function newDraft(surveyId: string, fingerprint: string, mode: SurveyMode, now = Date.now()): Draft {
  return { version: 1, surveyId, fingerprint, mode, answers: {}, submissionId: crypto.randomUUID(), retrySecret: randomSecret(), savedAt: now };
}

export type LoadedDraft = { draft: Draft; discarded: false } | { draft: undefined; discarded: boolean };

/**
 * Reads the saved draft. A draft for a different survey version, or older than 7 days, is removed,
 * and `discarded` tells the page to say so.
 */
export function loadDraft(surveyId: string, fingerprint: string, mode: SurveyMode, now = Date.now(), stores: DraftStores = browserStores): LoadedDraft {
  const key = draftKey(surveyId, mode);
  for (const store of [stores.session, stores.local]) {
    const draft = readJson<Draft>(store, key);
    if (!draft) continue;
    const expired = store === stores.local && now - draft.savedAt > draftLifetimeMilliseconds;
    const passExpired = draft.passExpiresAt !== undefined && Date.parse(draft.passExpiresAt) <= now;
    if (draft.version !== 1 || draft.fingerprint !== fingerprint || expired || passExpired) {
      store.removeItem(key);
      return { draft: undefined, discarded: true };
    }
    return { draft, discarded: false };
  }
  return { draft: undefined, discarded: false };
}

/** Saves the draft where it belongs: session storage for young people, local storage for adults. */
export function saveDraft(draft: Draft, youngPerson: boolean, now = Date.now(), stores: DraftStores = browserStores): Draft {
  const saved = { ...draft, savedAt: now };
  const key = draftKey(draft.surveyId, draft.mode);
  const [keep, other] = youngPerson ? [stores.session, stores.local] : [stores.local, stores.session];
  // A young person's draft never holds a tracked pass, because tracked links are for adults only.
  writeJson(keep, key, youngPerson ? { ...saved, trackedPass: undefined, passExpiresAt: undefined } : saved);
  other.removeItem(key);
  return saved;
}

/** Removes the draft after the server confirms the response, or when the person clears their answers. */
export function clearDraft(surveyId: string, mode: SurveyMode, stores: DraftStores = browserStores): void {
  const key = draftKey(surveyId, mode);
  stores.local.removeItem(key);
  stores.session.removeItem(key);
}

/** SHA-256 of the retry secret as hex. Only the hash leaves the browser. */
export async function hashRetrySecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
