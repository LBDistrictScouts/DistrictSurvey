import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Nunito_Sans } from "next/font/google";
import { logoPath, readBuildData } from "@/lib/config/build-data";
import { themeCss } from "@/lib/config/theme";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import "./globals.css";

const nunito = Nunito_Sans({ variable: "--font-nunito-sans", subsets: ["latin"], weight: ["400", "600", "700", "800"], display: "swap" });

const data = readBuildData();
const { settings } = data;

export const metadata: Metadata = {
  title: { default: `${settings.organisationName} survey`, template: `%s | ${settings.organisationName} survey` },
  description: `Tell ${settings.organisationName} about your experience of Scouting.`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: settings.theme.light.background },
    { media: "(prefers-color-scheme: dark)", color: settings.theme.dark.background },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={nunito.variable} suppressHydrationWarning>
      <head>
        {/* Theme colours from the survey settings. Styles may be inline under the security policy. */}
        <style>{themeCss(settings.theme)}</style>
      </head>
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-10 focus:bg-bg-white-0 focus:p-3">
            Skip to main content
          </a>
          <header className="border-b border-stroke-soft-200 bg-bg-white-0">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4">
              <Link href="/" className="no-underline">
                {/* The logo appears once per page, from the district settings. Only one of these is displayed. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPath(data, "light")} alt={settings.logos.alt} className="h-10 w-auto dark:hidden" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPath(data, "dark")} alt={settings.logos.alt} className="hidden h-10 w-auto dark:block" />
              </Link>
              <ThemeToggle />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-stroke-soft-200 bg-bg-white-0">
            <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 py-6 text-paragraph-sm text-text-sub-600">
              <Link href="/privacy">Privacy notice</Link>
              <span>{settings.organisationName}</span>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
