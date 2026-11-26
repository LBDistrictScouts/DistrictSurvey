import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the exported site and the real Lambda code behind the local server.
// Storage is memory unless AWS_ENDPOINT_URL points at Moto, as `yarn test:stack` arranges.
const port = 8787;
export const surveyNow = "2027-03-14T12:00:00Z";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // test:a11y writes its own report, so it does not replace the journey report the traceability check reads.
  reporter: [["list"], ["json", { outputFile: `reports/playwright${process.env.PLAYWRIGHT_REPORT_SUFFIX ?? ""}.json` }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `yarn tsx functions/local/server.ts --static out --port ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    env: {
      LOCAL_STORE: process.env.AWS_ENDPOINT_URL ? "moto" : "memory",
      LOCAL_NOW: surveyNow,
      TURNSTILE_VERIFY_URL: `http://localhost:${port}/__local/siteverify`,
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], colorScheme: "light" }, testIgnore: /accessibility/ },
    { name: "chromium-dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark" }, testIgnore: /accessibility/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: /accessibility/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: /accessibility/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testIgnore: /accessibility/ },
    { name: "a11y", use: { ...devices["Desktop Chrome"] }, testMatch: /accessibility/ },
  ],
});
