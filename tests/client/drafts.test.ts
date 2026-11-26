// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { clearDraft, draftKey, draftLifetimeMilliseconds, hashRetrySecret, loadDraft, newDraft, saveDraft } from "@/lib/client/drafts";
import { memoryStore, readJson, local, session, writeJson } from "@/lib/client/storage";

const fingerprint = `sha256:${"a".repeat(64)}`;

beforeAll(() => {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("drafts", () => {
  it("[G3] an adult draft is kept in local storage for 7 days with its submission ID and retry secret", () => {
    const draft = saveDraft({ ...newDraft("s", fingerprint, "open", 1000), answers: { "age-group": "adult" } }, false, 1000);
    expect(JSON.parse(localStorage.getItem(draftKey("s", "open"))!).answers).toEqual({ "age-group": "adult" });
    expect(sessionStorage.length).toBe(0);
    expect(draft.submissionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft.retrySecret).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(loadDraft("s", fingerprint, "open", 1000 + draftLifetimeMilliseconds)).toEqual({ draft, discarded: false });
    expect(loadDraft("s", fingerprint, "open", 1001 + draftLifetimeMilliseconds)).toEqual({ draft: undefined, discarded: true });
    expect(localStorage.length).toBe(0);
  });

  it("[G3] a young person's draft moves to session storage and loses any tracked pass", () => {
    const draft = newDraft("s", fingerprint, "open");
    saveDraft({ ...draft, trackedPass: "p", passExpiresAt: "2030-01-01T00:00:00Z" }, false);
    saveDraft({ ...draft, answers: { "age-group": "young-person" }, trackedPass: "p" }, true);
    expect(localStorage.getItem(draftKey("s", "open"))).toBeNull();
    const stored = JSON.parse(sessionStorage.getItem(draftKey("s", "open"))!);
    expect(stored.trackedPass).toBeUndefined();
    expect(loadDraft("s", fingerprint, "open").draft?.answers).toEqual({ "age-group": "young-person" });
  });

  it("[G3] drafts for another survey version or with an expired pass are discarded", () => {
    saveDraft(newDraft("s", fingerprint, "tracked"), false);
    expect(loadDraft("s", `sha256:${"b".repeat(64)}`, "tracked")).toEqual({ draft: undefined, discarded: true });

    saveDraft({ ...newDraft("s", fingerprint, "tracked"), passExpiresAt: "2020-01-01T00:00:00Z" }, false);
    expect(loadDraft("s", fingerprint, "tracked").discarded).toBe(true);
    expect(loadDraft("s", fingerprint, "tracked")).toEqual({ draft: undefined, discarded: false });
  });

  it("[G3] clearing removes the draft from both stores", () => {
    saveDraft(newDraft("s", fingerprint, "open"), true);
    saveDraft(newDraft("s", fingerprint, "open"), false);
    clearDraft("s", "open");
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it("hashes the retry secret with SHA-256", async () => {
    expect(await hashRetrySecret("s")).toBe("043a718774c572bd8a25adbeb1bfcd5c0256ae11cecf9f9c3f925d0e52beaf89");
  });
});

describe("storage", () => {
  it("falls back to memory when the browser refuses storage, and drops unreadable values", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new Error("blocked"); } });
    local.setItem("k", "v");
    expect(local.getItem("k")).toBe("v");
    local.removeItem("k");
    expect(local.getItem("k")).toBeNull();
    Object.defineProperty(window, "localStorage", original);

    session.setItem("bad", "{");
    expect(readJson(session, "bad")).toBeUndefined();
    expect(session.getItem("bad")).toBeNull();
    writeJson(memoryStore, "x", { a: 1 });
    expect(readJson(memoryStore, "x")).toEqual({ a: 1 });
    expect(readJson(memoryStore, "missing")).toBeUndefined();
  });
});
