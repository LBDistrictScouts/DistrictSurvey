// The parts of the build data the browser needs. Logos and the theme are applied at build time.
import type { BuildData } from "./build-data";

export type SiteSettings = {
  surveyId: string;
  organisationName: string;
  opensAt: string;
  closesAt: string;
  resultsUrl: string;
  privacyContact: string;
  helpContact: { text: string; email?: string; phone?: string };
};

export function siteSettings(data: BuildData): SiteSettings {
  const { surveyId, organisationName, opensAt, closesAt, resultsUrl, privacyContact, helpContact } = data.settings;
  return { surveyId, organisationName, opensAt, closesAt, resultsUrl, privacyContact, helpContact };
}

// Cloudflare's published test key always passes. Deployed builds set their own.
export const testTurnstileSiteKey = "1x00000000000000000000AA";

export function turnstileSiteKey(env: Record<string, string | undefined> = process.env): string {
  const key = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (key) return key;
  if (env.SURVEY_ENVIRONMENT === "test" || env.SURVEY_ENVIRONMENT === "prod") throw new Error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is required for deployed builds");
  return testTurnstileSiteKey;
}

export type SurveyWindowState = "before" | "open" | "closed";

/** Whether the page offers the survey now. It stops at closing; the server allows an extra hour. */
export function pageWindowState(settings: Pick<SiteSettings, "opensAt" | "closesAt">, now = Date.now()): SurveyWindowState {
  if (now < Date.parse(settings.opensAt)) return "before";
  if (now < Date.parse(settings.closesAt)) return "open";
  return "closed";
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}
