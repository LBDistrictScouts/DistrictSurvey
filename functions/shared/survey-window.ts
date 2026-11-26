import type { Controls } from "./controls";
import { ApiError } from "./http";

/** The dates both Lambdas need. They come from the survey settings bundled at build time. */
export type SurveyWindow = {
  surveyId: string;
  opensAt: string;
  closesAt: string;
};

// Submissions are accepted for 1 hour after closing, for people who started before the deadline.
export const graceMilliseconds = 60 * 60 * 1000;

/**
 * Results tokens and cookies work until 3 months after closing, at the same time of day. A day that
 * does not exist in the target month becomes that month's last day, so 31 March becomes 30 June.
 */
export function resultsExpiry(window: SurveyWindow): Date {
  const closes = new Date(window.closesAt);
  const expiry = new Date(closes);
  expiry.setUTCDate(1);
  expiry.setUTCMonth(expiry.getUTCMonth() + 3);
  const lastDay = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate();
  expiry.setUTCDate(Math.min(closes.getUTCDate(), lastDay));
  return expiry;
}

export type WindowState = "before" | "open" | "grace" | "closed";

export function windowState(window: SurveyWindow, now: Date): WindowState {
  const time = now.getTime();
  const opens = Date.parse(window.opensAt);
  const closes = Date.parse(window.closesAt);
  if (time < opens) return "before";
  if (time < closes) return "open";
  if (time < closes + graceMilliseconds) return "grace";
  return "closed";
}

/** Passes and receipts expire at closing + 1 hour, as unix seconds. */
export function passExpiry(window: SurveyWindow): number {
  return Math.floor((Date.parse(window.closesAt) + graceMilliseconds) / 1000);
}

/**
 * Throws survey_closed unless this kind of link may act now. The page stops offering the survey at
 * closing, so the grace hour only catches people who were already answering.
 */
export function requireOpen(window: SurveyWindow, controls: Controls, kind: "open" | "tracked", now: Date): void {
  const state = windowState(window, now);
  if (state === "before" || state === "closed") throw new ApiError("survey_closed");
  if (!controls.survey || !controls[kind]) throw new ApiError("survey_closed");
}

/** The Europe/London calendar date, which is the only time information stored with a response. */
export function londonDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
