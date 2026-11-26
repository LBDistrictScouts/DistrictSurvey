import { expect, test } from "./fixtures";

const promise = "Your answers are stored separately from your invitation, and people reviewing results only see grouped results. A volunteer reviewer reads any written comments. Answers are kept by the district with no deletion date.";
const technical = "To keep the survey working and fix faults, our systems keep short-term technical records, such as when a submission was received. This normally includes the exact time your answers were sent for up to 12 hours, and longer if a technical fault delays processing. We keep these records for up to 30 days, and we don't use them to work out who gave which answers.";
const young = "Our computers keep some short-term records so we can fix problems. We don't use them to work out who gave which answers.";

test("[G9] the start page gives the respondent promise and links to the privacy notice", async ({ survey: page }) => {
  await page.goto("/");
  await expect(page.getByText(promise, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Read the privacy notice" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("[G9] [G25] the privacy notice has the respondent promise and both technical records notices", async ({ survey: page }) => {
  await page.goto("/privacy");
  await expect(page.getByTestId("respondent-promise")).toHaveText(promise);
  await expect(page.getByTestId("technical-records")).toHaveText(technical);
  await expect(page.getByTestId("young-technical-records")).toHaveText(young);
});

test("the tracked page loads no third-party scripts", async ({ survey: page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  await page.goto("/invite");
  await page.waitForLoadState("networkidle");
  expect([...hosts]).toEqual(["localhost:8787"]);
});
