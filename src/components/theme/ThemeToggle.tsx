"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const choices = [
  { value: "system", label: "Device setting" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

/** The manual light and dark switch. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The saved choice is only known in the browser, so the switch shows it after loading.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <fieldset className="flex flex-wrap items-center gap-2 text-paragraph-sm">
      <legend className="sr-only">Colour theme</legend>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          aria-pressed={mounted ? (theme ?? "system") === choice.value : undefined}
          onClick={() => setTheme(choice.value)}
          className="min-h-9 rounded-10 px-3 text-text-strong-950 ring-1 ring-inset ring-stroke-sub-300 aria-pressed:bg-primary-alpha-16 aria-pressed:ring-2 aria-pressed:ring-primary-base"
        >
          {choice.label}
        </button>
      ))}
    </fieldset>
  );
}
