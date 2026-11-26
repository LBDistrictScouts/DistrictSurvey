import { expect, messagesFor, next, pick, test, trackedLink } from "./fixtures";
import type { Page } from "@playwright/test";

async function respondOnOpenLink(page: Page) {
  await page.goto("/survey");
  await pick(page, /Which best describes you/, "I'm an adult");
  await page.getByLabel("Scout Network member").check();
  await next(page);
  await pick(page, /Network activities/, "Monthly or more");
  await page.getByRole("button", { name: "Send my answers" }).click();
  await expect(page.getByRole("heading", { name: "Thank you, your answers have been received" })).toBeVisible();
}

test.describe("CUJ 2: volunteer answers on the open link, then opens their tracked link", () => {
  test("[G8] confirming completes the task with no second response, and the receipt is used up", async ({ survey: page }) => {
    await respondOnOpenLink(page);
    const { url, uuid } = trackedLink();
    await page.goto(url);

    await expect(page.getByRole("heading", { name: "Have you already answered this survey?" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, that was me" }).click();
    await expect(page.getByRole("heading", { name: "Thank you for taking part" })).toBeVisible();
    expect(await messagesFor(page, uuid)).toEqual(["completed"]);
    expect(await page.evaluate(() => localStorage.getItem("district-survey:example-2027:receipt"))).toBeNull();
  });

  test("[G8] a receipt cannot complete a second tracked link", async ({ survey: page }) => {
    await respondOnOpenLink(page);
    const stored = await page.evaluate(() => localStorage.getItem("district-survey:example-2027:receipt"));
    await page.goto(trackedLink().url);
    await page.getByRole("button", { name: "Yes, that was me" }).click();
    await expect(page.getByRole("heading", { name: "Thank you for taking part" })).toBeVisible();

    await page.evaluate((value) => localStorage.setItem("district-survey:example-2027:receipt", value!), stored);
    const second = trackedLink();
    await page.goto(second.url);
    await page.getByRole("button", { name: "Yes, that was me" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "A response has already been received for this invitation." })).toBeVisible();
    expect(await messagesFor(page, second.uuid)).toEqual([]);
  });
});

test.describe("CUJ 3: someone else on a shared device opens a tracked link", () => {
  test("[G8] saying no leaves the receipt unused and starts the survey", async ({ survey: page }) => {
    await respondOnOpenLink(page);
    const { url, uuid } = trackedLink();
    await page.goto(url);
    await page.getByRole("button", { name: "No, I haven't answered yet" }).click();
    await page.getByRole("button", { name: "Start the survey" }).click();
    await expect(page.getByLabel("Volunteer")).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("district-survey:example-2027:receipt"))).not.toBeNull();
    expect(await messagesFor(page, uuid)).toEqual(["started"]);
  });
});
