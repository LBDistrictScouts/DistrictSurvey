import { readFileSync } from "node:fs";
import { defaultTheme } from "@lbdistrictscouts/survey-engine/compiler";
import { contrastRatio, requiredColourPairs, validateTheme } from "@lbdistrictscouts/survey-engine/validator";
import { brandVariables, themeCss } from "@/lib/config/theme";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

const names = { background: "background", surface: "surface", text: "text", muted: "muted", primary: "primary", onPrimary: "on-primary", accent: "accent", link: "link", focus: "focus", helpBackground: "help-background", helpText: "help-text" } as const;

function themeFromCss(selector: ":root" | ".dark") {
  const variables = brandVariables(css, selector);
  return Object.fromEntries(Object.entries(names).map(([key, name]) => [key, variables[name]])) as typeof defaultTheme.light;
}

describe("theme contrast", () => {
  it("[G4] the stylesheet's default colours are the engine's defaults", () => {
    expect(themeFromCss(":root")).toEqual(defaultTheme.light);
    expect(themeFromCss(".dark")).toEqual(defaultTheme.dark);
  });

  it("[G4] every required colour pair meets its target in both themes", () => {
    expect(validateTheme({ light: themeFromCss(":root"), dark: themeFromCss(".dark") })).toEqual([]);
    for (const mode of ["light", "dark"] as const) {
      for (const [foreground, background, minimum] of requiredColourPairs) expect(contrastRatio(defaultTheme[mode][foreground], defaultTheme[mode][background])).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("[G4] the extra colours in the stylesheet meet their targets too", () => {
    for (const selector of [":root", ".dark"] as const) {
      const variables = brandVariables(css, selector);
      expect(contrastRatio(variables.error!, variables.surface!), `${selector} error`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(variables.success!, variables.surface!), `${selector} success`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(variables["on-primary"]!, variables.primary!), `${selector} buttons`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("writes settings colours as CSS, ignoring anything that is not a colour", () => {
    expect(themeCss(defaultTheme)).toContain(":root{--brand-background:#f5f8f8;");
    expect(themeCss({ ...defaultTheme, light: { ...defaultTheme.light, text: "red;}body{display:none" } })).not.toContain("display:none");
  });
});
