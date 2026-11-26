import { expect, next, pick, test } from "./fixtures";

test.describe("CUJ 4: parent or carer responds through the open link", () => {
  test("[G1] [G2] [G8] the questions follow the roles chosen, and a receipt is saved", async ({ survey: page }) => {
    await page.goto("/survey");
    await pick(page, /Which best describes you/, "I'm an adult");
    await page.getByLabel("Parent or carer").check();
    await page.getByRole("group", { name: /sections are your children in/ }).getByLabel("Cubs").check();

    // A young person's question never appears beside adult roles.
    await expect(page.getByRole("group", { name: /Which section are you in/ })).toHaveCount(0);
    await next(page);

    await expect(page.getByRole("group", { name: /good value for your family/ })).toBeVisible();
    await expect(page.getByRole("group", { name: /How supported do you feel/ })).toHaveCount(0);
    await pick(page, /keep you informed/, "5: Very well");
    await pick(page, /good value for your family/, "Yes");
    await page.getByRole("button", { name: "Send my answers" }).click();

    await expect(page.getByRole("heading", { name: "Thank you, your answers have been received" })).toBeVisible();
    await expect(page.getByRole("link", { name: /results/ })).toHaveCount(0);
    const receipt = await page.evaluate(() => localStorage.getItem("district-survey:example-2027:receipt"));
    expect(JSON.parse(receipt!).receipt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}$/);
  });

  test("[G1] a question shared by two roles is asked once, and changing roles warns before removing answers", async ({ survey: page }) => {
    await page.goto("/survey");
    await pick(page, /Which best describes you/, "I'm an adult");
    await page.getByLabel("Parent or carer").check();
    await page.getByLabel("Volunteer").check();
    await page.getByRole("group", { name: /sections are your children in/ }).getByLabel("Scouts").check();
    await next(page);
    await expect(page.getByRole("group", { name: /keep you informed/ })).toHaveCount(1);
    await pick(page, /good value for your family/, "Mostly");

    await page.getByRole("button", { name: "Back" }).click();
    await page.getByLabel("Parent or carer").click();
    const dialog = page.getByRole("dialog", { name: "Change this answer?" });
    await expect(dialog).toContainText("2 answers you gave no longer apply");
    await dialog.getByRole("button", { name: "Keep my answer" }).click();
    await expect(page.getByLabel("Parent or carer")).toBeChecked();

    await page.getByLabel("Parent or carer").click();
    await page.getByRole("dialog").getByRole("button", { name: "Change it" }).click();
    await expect(page.getByLabel("Parent or carer")).not.toBeChecked();
    await expect(page.getByRole("group", { name: /sections are your children in/ })).toHaveCount(0);
  });

  test("required questions are explained before moving on", async ({ survey: page }) => {
    await page.goto("/survey");
    // With nothing answered yet, this is the only section, so its button sends the answers.
    await page.getByRole("button", { name: /Continue|Send my answers/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "There is a problem with 1 answer" })).toBeVisible();
    await expect(page.getByText("Answer this question to continue.")).toBeVisible();
  });
});
