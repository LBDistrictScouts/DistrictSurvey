import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { compiledSurveySchema, compileSurvey, fingerprintSurvey, parseSurveyFile, surveySettingsSchema, type SurveySettings } from "@lbdistrictscouts/survey-engine/compiler";
import type { CompiledSurvey } from "@lbdistrictscouts/survey-engine";
import { parse } from "yaml";
import { z } from "zod";

/**
 * Everything a build needs about one survey: the approved compiled survey, its settings and logos.
 * The survey site and the response Lambda are built from the same file, so their fingerprints match.
 */
export type BuildData = {
  schemaVersion: "1.0";
  surveyId: string;
  versionNumber: number;
  compiled: CompiledSurvey;
  settings: SurveySettings;
  logos: { light: Logo; dark: Logo };
};

export type Logo = { contentType: "image/svg+xml" | "image/png" | "image/webp"; base64: string };

export class BuildDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildDataError";
  }
}

const logoSchema = z.strictObject({ contentType: z.enum(["image/svg+xml", "image/png", "image/webp"]), base64: z.base64().max(1_400_000) });

const buildDataSchema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  surveyId: z.string(),
  versionNumber: z.int().positive(),
  compiled: compiledSurveySchema,
  settings: surveySettingsSchema,
  logos: z.strictObject({ light: logoSchema, dark: logoSchema }),
});

export const buildDataPath = join(process.cwd(), ".build-data", "build-data.json");
export const brandDirectory = join(process.cwd(), "public", "brand");

/** Checks build data from any source, including that the fingerprint really matches the compiled survey. */
export function checkBuildData(data: unknown, expectedSurveyId?: string): BuildData {
  const parsed = buildDataSchema.safeParse(data);
  if (!parsed.success) throw new BuildDataError(`Build data is invalid: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);

  const value = parsed.data as BuildData;
  if (expectedSurveyId && value.surveyId !== expectedSurveyId) throw new BuildDataError(`Build data is for ${value.surveyId}, not ${expectedSurveyId}`);
  if (value.compiled.surveyId !== value.surveyId || value.settings.surveyId !== value.surveyId) throw new BuildDataError("The compiled survey, settings and build data name different surveys");
  if (fingerprintSurvey(value.compiled) !== value.compiled.fingerprint) throw new BuildDataError("The compiled survey's fingerprint does not match its questions");
  return value;
}

/** Made-up data from examples/, used by pull request builds, tests and local development. */
export function exampleBuildData(root = process.cwd()): BuildData {
  const compiled = compileSurvey(parseSurveyFile(readFileSync(join(root, "examples", "survey.example.yaml"), "utf8")));
  const settings = surveySettingsSchema.parse(parse(readFileSync(join(root, "examples", "settings.example.yaml"), "utf8")));
  const logo = (name: string): Logo => ({ contentType: "image/svg+xml", base64: readFileSync(join(root, "examples", "logos", name)).toString("base64") });
  return checkBuildData({ schemaVersion: "1.0", surveyId: compiled.surveyId, versionNumber: 1, compiled, settings, logos: { light: logo(settings.logos.light), dark: logo(settings.logos.dark) } });
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/** Fetches the approved version from DistrictStatistics with the build token. */
export async function fetchBuildData(baseUrl: string, surveyId: string, token: string, fetcher: Fetch = fetch): Promise<BuildData> {
  let response: Response;
  try {
    response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/v1/surveys/${encodeURIComponent(surveyId)}/build-data`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new BuildDataError("DistrictStatistics is unavailable, so the build cannot continue");
  }
  if (!response.ok) throw new BuildDataError(`DistrictStatistics returned ${response.status} for the build data`);
  return checkBuildData(await response.json(), surveyId);
}

/**
 * Chooses where build data comes from. Builds for the test and production environments must use
 * real data, and fail if it is unavailable, so example questions can never be deployed.
 */
export async function loadBuildData(env: Record<string, string | undefined> = process.env, fetcher: Fetch = fetch): Promise<BuildData> {
  const deployed = env.SURVEY_ENVIRONMENT === "test" || env.SURVEY_ENVIRONMENT === "prod";
  const source = env.SURVEY_DATA_SOURCE ?? (deployed ? "data-core" : "example");

  if (source === "example") {
    if (deployed) throw new BuildDataError(`${env.SURVEY_ENVIRONMENT} builds cannot use example data`);
    return exampleBuildData();
  }
  if (source !== "data-core") throw new BuildDataError(`Unknown SURVEY_DATA_SOURCE ${source}`);

  const missing = ["DATA_CORE_URL", "SURVEY_ID", "SURVEY_BUILD_TOKEN"].filter((name) => !env[name]);
  if (missing.length > 0) throw new BuildDataError(`Missing ${missing.join(", ")} for a build from DistrictStatistics`);
  return fetchBuildData(env.DATA_CORE_URL!, env.SURVEY_ID!, env.SURVEY_BUILD_TOKEN!, fetcher);
}

const extensions: Record<Logo["contentType"], string> = { "image/svg+xml": "svg", "image/png": "png", "image/webp": "webp" };

export function logoPath(data: BuildData, mode: "light" | "dark"): string {
  return `/brand/logo-${mode}.${extensions[data.logos[mode].contentType]}`;
}

/** Writes the build data and logos where `next build` and scripts/build-functions.mjs read them. */
export function writeBuildData(data: BuildData, path = buildDataPath, brand = brandDirectory): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  mkdirSync(brand, { recursive: true });
  for (const mode of ["light", "dark"] as const) writeFileSync(join(brand, logoPath(data, mode).replace("/brand/", "")), Buffer.from(data.logos[mode].base64, "base64"));
}

/** Reads the build data written by `yarn build-data`, falling back to the examples in development. */
export function readBuildData(path = buildDataPath): BuildData {
  if (!existsSync(path)) return exampleBuildData();
  return checkBuildData(JSON.parse(readFileSync(path, "utf8")));
}

// `yarn build-data` runs this file directly.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  loadBuildData()
    .then((data) => {
      writeBuildData(data);
      console.log(`Build data for ${data.surveyId} version ${data.versionNumber} (${data.compiled.fingerprint})`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
