// Automated accessibility checks with pa11y-ci, alongside axe in Playwright. Run with `yarn test:a11y`,
// which starts the local server first. Pages are checked in both themes.
// pa11y reuses the Chromium that Playwright installs, so CI downloads one browser.
const { chromium } = require("playwright-core");

const base = process.env.PA11Y_BASE_URL ?? "http://localhost:8789";
const pages = ["/", "/survey", "/invite", "/privacy", "/not-a-page"];
const themes = ["light", "dark"];

module.exports = {
  defaults: {
    standard: "WCAG2AA",
    runners: ["htmlcs", "axe"],
    timeout: 30000,
    chromeLaunchConfig: { executablePath: chromium.executablePath(), args: ["--no-sandbox"] },
  },
  urls: pages.flatMap((path) =>
    themes.map((theme) => ({
      url: `${base}${path}`,
      // The theme switch stores its choice; setting it before loading gives the dark theme.
      actions: theme === "dark" ? ["click element button:nth-of-type(3)", "wait for element html.dark to be added"] : [],
    })),
  ),
};
