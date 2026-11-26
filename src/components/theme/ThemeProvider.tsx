"use client";

import { ThemeProvider as NextThemes } from "next-themes";

export const themeStorageKey = "district-survey:theme";

/**
 * Sets the light or dark class before first paint, following the device setting until the person
 * chooses. The script next-themes writes inline is moved into a file after the build.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem storageKey={themeStorageKey} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
