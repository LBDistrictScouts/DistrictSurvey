import AxeBuilder from "@axe-core/playwright";
import { expect, next, pick, test, trackedLink } from "./fixtures";
import type { Page } from "@playwright/test";

async function axe(page: Page) {
  // Dialogs fade in. Colours are measured once every animation has finished.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => `${node.target.join(" ")} (${node.failureSummary?.replace(/\s+/g, " ")})`).join(", ")}`)).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test(`[G4] start, privacy and missing pages pass automated checks`, async ({ survey: page }) => {
      for (const path of ["/", "/privacy", "/not-a-page"]) {
        await page.goto(path);
        await axe(page);
      }
    });

    test(`[G4] every step of the open-link survey passes automated checks`, async ({ survey: page }) => {
      await page.goto("/survey");
      await axe(page);
      // With nothing answered this is the only section, so its button sends the answers and shows the errors.
      await page.getByRole("button", { name: "Send my answers" }).click();
      await axe(page);
      await pick(page, /Which best describes you/, "I'm in a Scout section");
      await pick(page, /Which section are you in/, "Scouts");
      await next(page);
      await axe(page);
      await page.getByRole("button", { name: "Back" }).click();
      // Switching to an adult opens the warning about answers that no longer apply.
      await page.getByRole("group", { name: /Which best describes you/ }).getByLabel("I'm an adult").click();
      await expect(page.getByRole("dialog", { name: "Change this answer?" })).toBeVisible();
      await axe(page);
    });

    test(`[G4] the tracked link pages pass automated checks`, async ({ survey: page }) => {
      await page.goto(trackedLink().url);
      await expect(page.getByRole("button", { name: "Start the survey" })).toBeVisible();
      await axe(page);
      await page.getByRole("button", { name: /suppress any further reminders/ }).click();
      await axe(page);
    });
  });
}

test("[G4] the survey can be completed with the keyboard alone", async ({ survey: page }) => {
  await page.goto("/survey");
  await page.getByRole("radio", { name: "I'm in a Scout section" }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Beavers" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Cubs" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio", { name: "Cubs" })).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your section" })).toBeFocused();
});
