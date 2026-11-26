import { londonDate, passExpiry, requireOpen, resultsExpiry, windowState } from "../../functions/shared/survey-window";
import { ApiError } from "../../functions/shared/http";
import type { Controls } from "../../functions/shared/controls";

const window = { surveyId: "example-2027", opensAt: "2027-03-01T09:00:00Z", closesAt: "2027-03-31T22:59:00Z" };
const on: Controls = { open: true, tracked: true, survey: true, resultsCookies: true };

function closedCode(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return "accepted";
}

describe("survey window", () => {
  it("[G21] moves from before to open to the grace hour to closed", () => {
    expect(windowState(window, new Date("2027-03-01T08:59:59Z"))).toBe("before");
    expect(windowState(window, new Date("2027-03-01T09:00:00Z"))).toBe("open");
    expect(windowState(window, new Date("2027-03-31T22:58:59Z"))).toBe("open");
    expect(windowState(window, new Date("2027-03-31T22:59:00Z"))).toBe("grace");
    expect(windowState(window, new Date("2027-03-31T23:58:59Z"))).toBe("grace");
    expect(windowState(window, new Date("2027-03-31T23:59:00Z"))).toBe("closed");
  });

  it("[G21] accepts submissions while open and in the grace hour, and only when switched on", () => {
    expect(closedCode(() => requireOpen(window, on, "open", new Date("2027-03-15T12:00:00Z")))).toBe("accepted");
    expect(closedCode(() => requireOpen(window, on, "tracked", new Date("2027-03-31T23:30:00Z")))).toBe("accepted");
    expect(closedCode(() => requireOpen(window, on, "open", new Date("2027-04-01T00:00:00Z")))).toBe("survey_closed");
    expect(closedCode(() => requireOpen(window, on, "open", new Date("2027-02-01T00:00:00Z")))).toBe("survey_closed");
    expect(closedCode(() => requireOpen(window, { ...on, open: false }, "open", new Date("2027-03-15T12:00:00Z")))).toBe("survey_closed");
    expect(closedCode(() => requireOpen(window, { ...on, open: false }, "tracked", new Date("2027-03-15T12:00:00Z")))).toBe("accepted");
    expect(closedCode(() => requireOpen(window, { ...on, tracked: false }, "tracked", new Date("2027-03-15T12:00:00Z")))).toBe("survey_closed");
    expect(closedCode(() => requireOpen(window, { ...on, survey: false }, "tracked", new Date("2027-03-15T12:00:00Z")))).toBe("survey_closed");
  });

  it("[G21] passes expire an hour after closing, and results 3 months after", () => {
    expect(new Date(passExpiry(window) * 1000).toISOString()).toBe("2027-03-31T23:59:00.000Z");
    expect(resultsExpiry(window).toISOString()).toBe("2027-06-30T22:59:00.000Z");
    expect(resultsExpiry({ ...window, closesAt: "2027-11-30T12:00:00Z" }).toISOString()).toBe("2028-02-29T12:00:00.000Z");
    expect(resultsExpiry({ ...window, closesAt: "2027-01-15T12:00:00Z" }).toISOString()).toBe("2027-04-15T12:00:00.000Z");
  });

  it("[G6] stores the Europe/London date only", () => {
    expect(londonDate(new Date("2027-03-14T23:30:00Z"))).toBe("2027-03-14");
    expect(londonDate(new Date("2027-07-14T23:30:00Z"))).toBe("2027-07-15");
  });
});
