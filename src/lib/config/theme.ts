import type { ThemeColours } from "@lbdistrictscouts/survey-engine/compiler";

const names: Record<keyof ThemeColours, string> = {
  background: "--brand-background",
  surface: "--brand-surface",
  text: "--brand-text",
  muted: "--brand-muted",
  primary: "--brand-primary",
  onPrimary: "--brand-on-primary",
  accent: "--brand-accent",
  link: "--brand-link",
  focus: "--brand-focus",
  helpBackground: "--brand-help-background",
  helpText: "--brand-help-text",
};

const hex = /^#[0-9a-f]{6}$/i;

function declarations(colours: ThemeColours): string {
  return (Object.keys(names) as (keyof ThemeColours)[])
    .filter((key) => hex.test(colours[key]))
    .map((key) => `${names[key]}:${colours[key]};`)
    .join("");
}

/** CSS that replaces the default brand colours with the ones in the survey settings. */
export function themeCss(theme: { light: ThemeColours; dark: ThemeColours }): string {
  return `:root{${declarations(theme.light)}}.dark{${declarations(theme.dark)}}`;
}

/** Reads the brand variables of one selector from globals.css, for the contrast test. */
export function brandVariables(css: string, selector: ":root" | ".dark"): Record<string, string> {
  const block = new RegExp(`(^|\\n)${selector.replace(".", "\\.")} \\{([^}]*)\\}`).exec(css)?.[2] ?? "";
  return Object.fromEntries([...block.matchAll(/--brand-([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1]!, match[2]!.toLowerCase()]));
}
