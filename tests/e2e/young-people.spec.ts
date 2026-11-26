import { expect, next, pick, test } from "./fixtures";

test.describe("CUJ 6: Beaver or Cub takes part with an adult", () => {
  test("[G14] Cubs see no free text, get no receipt, and their draft lasts only for the tab", async ({ survey: page }) => {
    await page.goto("/survey");
    await pick(page, /Which best describes you/, "I'm in a Scout section");
    await pick(page, /Which section are you in/, "Cubs");
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes(":draft")))).toEqual([]);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.includes(":draft")))).toHaveLength(1);
    await next(page);

    await expect(page.getByRole("textbox")).toHaveCount(0);
    await pick(page, /enjoy your meetings/, "5: A lot");
    await pick(page, /What do you like best/, "Being outdoors");
    await page.getByRole("button", { name: "Send my answers" }).click();

    await expect(page.getByRole("heading", { name: "Thank you, your answers have been received" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("district-survey:example-2027:receipt"))).toBeNull();
  });
});

test.describe("CUJ 5: a comment is submitted for review", () => {
  test("[G15] [G14] Explorers see the help message beside their comment box", async ({ survey: page }) => {
    await page.goto("/survey");
    await pick(page, /Which best describes you/, "I'm in a Scout section");
    await pick(page, /Which section are you in/, "Explorers");
    await next(page);

    const help = page.getByRole("complementary", { name: "Getting help" });
    await expect(help).toContainText("Comments are not read straight away");
    await expect(help).toContainText("help@example.org");
    await pick(page, /enjoy your meetings/, "4");
    await pick(page, /How much say/, "3");
    await page.getByLabel(/anything else you want to tell us/).fill("More camps please");
    await expect(page.getByText("17/500")).toBeVisible();
    await page.getByRole("button", { name: "Send my answers" }).click();
    await expect(page.getByRole("heading", { name: "Thank you, your answers have been received" })).toBeVisible();
  });
});
