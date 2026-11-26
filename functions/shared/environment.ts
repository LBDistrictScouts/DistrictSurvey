/** Reads a required environment variable, failing at start-up rather than on a request. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Values bundled into each Lambda by scripts/build-functions.mjs with esbuild's `define`, so the
 * deployed code and the survey site use the same compiled survey. The local server sets them itself.
 */
export type BundledSettings = {
  buildId: string;
  surveyId: string;
  opensAt: string;
  closesAt: string;
};
