import { execFileSync } from "node:child_process";
import { test as base, expect, type Page } from "@playwright/test";

export const surveyNow = new Date("2027-03-14T12:00:00Z");

/** A fake Turnstile that hands out a token when asked, so tests need no network. */
const fakeTurnstile = `
window.turnstile = {
  render(container, options) { window.__turnstile = options; return "widget"; },
  reset() {},
  execute() { setTimeout(() => window.__turnstile.callback("test-token"), 10); },
};`;

export const test = base.extend<{ survey: Page }>({
  survey: async ({ page }, provide) => {
    await page.clock.setFixedTime(surveyNow);
    await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: fakeTurnstile }));
    await provide(page);
  },
});

export { expect };

/** A tracked link signed with the local secrets, as DistrictWorkflow would send it. */
export function trackedLink(): { url: string; uuid: string } {
  const output = execFileSync("yarn", ["tsx", "scripts/sign-test-link.ts", "--env", "local", "--base-url", ""], { encoding: "utf8" });
  const [uuidLine, url] = output.trim().split("\n").slice(-2);
  return { uuid: uuidLine!.replace("Invite UUID ", ""), url: url! };
}

export async function messagesFor(page: Page, uuid: string): Promise<string[]> {
  const response = await page.request.get("/__local/messages");
  return ((await response.json()) as { inviteUuid: string; event: string }[]).filter((message) => message.inviteUuid === uuid).map((message) => message.event);
}

export async function choose(page: Page, label: string | RegExp) {
  await page.getByLabel(label, { exact: typeof label === "string" }).check();
}

export async function next(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Picks an answer within one question, found by its wording. */
export async function pick(page: Page, question: RegExp, option: string) {
  await page.getByRole("group", { name: question }).getByLabel(option, { exact: true }).check();
}

/** Answers the questions a volunteer sees after the first section. */
export async function answerVolunteerQuestions(page: Page) {
  await pick(page, /keep you informed/, "4");
  await pick(page, /How supported do you feel/, "3");
  await pick(page, /hours a week/, "2 to 5");
}
