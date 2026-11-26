// The tracked link token arrives in the address fragment, which browsers never send to the server.
// It is read once and removed from the address bar, so it is not left in history or shared by accident.
import { local, type KeyValueStore } from "./storage";

let remembered: string | undefined;

type LocationLike = Pick<Location, "hash" | "pathname" | "search">;
type HistoryLike = Pick<History, "replaceState">;

const tokenPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;

/** Reads the token from #invite=..., removes it from the address bar and keeps it in memory only. */
export function readInviteToken(location: LocationLike = window.location, history: HistoryLike = window.history): string | undefined {
  const match = /(?:^#|&)invite=([^&]+)/.exec(location.hash);
  if (match) {
    const token = decodeURIComponent(match[1]!);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    remembered = tokenPattern.test(token) ? token : undefined;
    return remembered;
  }
  return remembered;
}

/** Forgets the token, as a reload does. */
export function forgetInviteToken(): void {
  remembered = undefined;
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Remembers on this device that reminders were turned off for this link, so reopening it says so. Only
 * a hash of the token is stored.
 */
export async function markDeclined(token: string, store: KeyValueStore = local): Promise<void> {
  store.setItem(`district-survey:declined:${await tokenHash(token)}`, "1");
}

export async function wasDeclined(token: string, store: KeyValueStore = local): Promise<boolean> {
  return store.getItem(`district-survey:declined:${await tokenHash(token)}`) === "1";
}
