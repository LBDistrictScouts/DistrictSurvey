import { answerVolunteerQuestions, expect, messagesFor, next, test, trackedLink } from "./fixtures";

test.describe("CUJ 1: invited volunteer completes the survey", () => {
  test("[G5] [G7] [G1] start, answer the volunteer questions and see the results link", async ({ survey: page }) => {
    const { url, uuid } = trackedLink();
    await page.goto(url);

    // The link is removed from the address bar as soon as it is read.
    await expect(page.getByRole("heading", { name: "Your invitation" })).toBeVisible();
    expect(page.url()).not.toContain("invite=");

    await page.getByRole("button", { name: "Start the survey" }).click();

    // A tracked link offers adults only, with Volunteer preselected.
    await expect(page.getByLabel("I'm in a Scout section")).toHaveCount(0);
    await expect(page.getByLabel("I'm an adult")).toBeChecked();
    await expect(page.getByLabel("Volunteer")).toBeChecked();
    await next(page);

    await expect(page.getByRole("heading", { name: "Your experience" })).toBeFocused();
    await answerVolunteerQuestions(page);
    await page.getByRole("button", { name: "Send my answers" }).click();

    await expect(page.getByRole("heading", { name: "Thank you for taking part" })).toBeVisible();
    await expect(page.getByRole("link", { name: "See the results so far" })).toHaveAttribute("href", /^https:\/\/results\.example\.org\/access#token=/);
    expect(await messagesFor(page, uuid)).toEqual(["started", "completed"]);

    // Nothing is left in browser storage.
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes(":draft")))).toEqual([]);
  });

  test("[G7] opening a used link again completes it, with no second response", async ({ survey: page }) => {
    const { url, uuid } = trackedLink();
    await page.goto(url);
    await page.getByRole("button", { name: "Start the survey" }).click();
    await next(page);
    await answerVolunteerQuestions(page);
    await page.getByRole("button", { name: "Send my answers" }).click();
    await expect(page.getByRole("heading", { name: "Thank you for taking part" })).toBeVisible();

    await page.goto("/");
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Thank you for taking part" })).toBeVisible();
    expect(await messagesFor(page, uuid)).toEqual(["started", "completed", "completed"]);
  });

  test("[G3] a reload removes the link from memory and asks the person to reopen it", async ({ survey: page }) => {
    const { url } = trackedLink();
    await page.goto(url);
    await page.getByRole("button", { name: "Start the survey" }).click();
    await page.reload();
    await expect(page.getByText("Please open your invitation link again")).toBeVisible();
    await expect(page.getByText("Your answers so far are saved on this device.")).toBeVisible();
  });
});
