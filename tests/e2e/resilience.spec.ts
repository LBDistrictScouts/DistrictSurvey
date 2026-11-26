import { expect, next, pick, test } from "./fixtures";

test.describe("CUJ 8: the connection fails during submission", () => {
  test("[G3] answers stay in the browser, and the retry reuses the submission ID", async ({ survey: page }) => {
    const bodies: { submissionId: string }[] = [];
    let failures = 1;
    await page.route("**/api/v1/responses/open", async (route) => {
      bodies.push(JSON.parse(route.request().postData()!));
      if (failures-- > 0) return route.abort("connectionreset");
      return route.continue();
    });

    await page.goto("/survey");
    await pick(page, /Which best describes you/, "I'm in a Scout section");
    await pick(page, /Which section are you in/, "Beavers");
    await next(page);
    await pick(page, /enjoy your meetings/, "3");
    await pick(page, /What do you like best/, "Games");
    await page.getByRole("button", { name: "Send my answers" }).click();

    await expect(page.getByRole("heading", { name: "Thank you, your answers have been received" })).toBeVisible();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.submissionId).toBe(bodies[0]!.submissionId);
  });

  test("[G3] when every attempt fails, the answers stay saved and the message says so", async ({ survey: page }) => {
    await page.route("**/api/v1/responses/open", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) }));
    test.setTimeout(60_000);
    await page.goto("/survey");
    await pick(page, /Which best describes you/, "I'm an adult");
    await page.getByLabel("Scout Network member").check();
    await next(page);
    await pick(page, /Network activities/, "Rarely");
    await page.getByRole("button", { name: "Send my answers" }).click();
    // Three retries wait 1, 3 and 8 seconds before the page gives up.
    await expect(page.getByRole("alert").filter({ hasText: "Your answers are still saved on this device." })).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByLabel("I'm an adult")).toBeChecked();
    await expect(page.getByLabel("Scout Network member")).toBeChecked();
  });
});

test.describe("survey window", () => {
  test("[G21] the page stops offering the survey at closing", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2027-04-01T09:00:00Z"));
    await page.goto("/survey");
    await expect(page.getByText("This survey has closed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  });

  test("[G21] a submission refused after the grace hour explains why", async ({ survey: page }) => {
    await page.route("**/api/v1/responses/open", (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "survey_closed" }) }));
    await page.goto("/survey");
    await pick(page, /Which best describes you/, "I'm in a Scout section");
    await pick(page, /Which section are you in/, "Cubs");
    await next(page);
    await pick(page, /enjoy your meetings/, "2");
    await pick(page, /What do you like best/, "Earning badges");
    await page.getByRole("button", { name: "Send my answers" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "This survey has closed, so we can't accept new answers." })).toBeVisible();
  });

  test("the page says when the survey opens", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2027-02-01T09:00:00Z"));
    await page.goto("/survey");
    await expect(page.getByText("The survey opens on 1 March 2027")).toBeVisible();
  });
});
