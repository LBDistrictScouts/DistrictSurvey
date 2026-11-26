import { expect, messagesFor, test, trackedLink } from "./fixtures";

test.describe("CUJ 13: volunteer opts out of reminders", () => {
  test("declining sends declined after confirming, and reopening still allows taking part", async ({ survey: page }) => {
    const { url, uuid } = trackedLink();
    await page.goto(url);
    await page.getByRole("button", { name: "I don't want to complete the survey, please suppress any further reminders for this survey." }).click();

    const dialog = page.getByRole("dialog", { name: "Stop reminders for this survey?" });
    await dialog.getByRole("button", { name: "Go back" }).click();
    expect(await messagesFor(page, uuid)).toEqual([]);

    await page.getByRole("button", { name: /suppress any further reminders/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Stop reminders" }).click();
    await expect(page.getByText("We won't send you any more reminders", { exact: true })).toBeVisible();
    expect(await messagesFor(page, uuid)).toEqual(["declined"]);

    await page.goto("/");
    await page.goto(url);
    await expect(page.getByText("You asked us to stop reminders for this survey")).toBeVisible();
    await page.getByRole("button", { name: "Start the survey" }).click();
    await expect(page.getByLabel("Volunteer")).toBeChecked();
  });
});
