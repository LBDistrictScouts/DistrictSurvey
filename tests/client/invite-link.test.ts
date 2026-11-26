// @vitest-environment jsdom
import { forgetInviteToken, markDeclined, readInviteToken, wasDeclined } from "@/lib/client/invite-link";
import { memoryStore } from "@/lib/client/storage";

const token = `eyJ2IjoxfQ.${"A".repeat(43)}`;

function at(hash: string) {
  const calls: string[] = [];
  return { location: { hash, pathname: "/invite", search: "" }, history: { replaceState: (_: unknown, __: string, url: string) => void calls.push(url) }, calls };
}

beforeEach(() => forgetInviteToken());

describe("invite links", () => {
  it("[G6] reads the token once, removes it from the address bar and keeps it in memory", () => {
    const first = at(`#invite=${token}`);
    expect(readInviteToken(first.location, first.history)).toBe(token);
    expect(first.calls).toEqual(["/invite"]);

    const later = at("");
    expect(readInviteToken(later.location, later.history)).toBe(token);
    expect(later.calls).toEqual([]);

    forgetInviteToken();
    expect(readInviteToken(later.location, later.history)).toBeUndefined();
  });

  it("refuses malformed tokens but still clears them from the address bar", () => {
    const bad = at("#invite=not-a-token");
    expect(readInviteToken(bad.location, bad.history)).toBeUndefined();
    expect(bad.calls).toEqual(["/invite"]);
  });

  it("remembers a declined link by its hash only", async () => {
    await markDeclined(token, memoryStore);
    expect(await wasDeclined(token, memoryStore)).toBe(true);
    expect(await wasDeclined(`${token.slice(0, -1)}B`, memoryStore)).toBe(false);
  });
});
