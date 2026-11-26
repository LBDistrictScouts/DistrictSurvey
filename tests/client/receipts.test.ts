// @vitest-environment jsdom
import { clearReceipt, loadReceipt, receiptKey, saveReceipt } from "@/lib/client/receipts";

beforeEach(() => localStorage.clear());

describe("receipts", () => {
  it("[G8] keeps an adult's receipt until it expires an hour after closing", () => {
    saveReceipt("s", "receipt", "2027-03-31T23:59:00Z");
    expect(loadReceipt("s", Date.parse("2027-03-31T23:58:59Z"))).toEqual({ receipt: "receipt", expiresAt: "2027-03-31T23:59:00Z" });
    expect(loadReceipt("s", Date.parse("2027-03-31T23:59:00Z"))).toBeUndefined();
    expect(localStorage.getItem(receiptKey("s"))).toBeNull();
  });

  it("[G8] can be cleared, and ignores malformed values", () => {
    saveReceipt("s", "receipt", "2027-03-31T23:59:00Z");
    clearReceipt("s");
    expect(loadReceipt("s")).toBeUndefined();
    localStorage.setItem(receiptKey("s"), JSON.stringify({ receipt: "", expiresAt: "never" }));
    expect(loadReceipt("s")).toBeUndefined();
  });
});
