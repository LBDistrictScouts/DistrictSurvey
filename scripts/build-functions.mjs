// Bundles each Lambda separately with esbuild. The response Lambda gets the compiled survey from the
// same build data as the survey site, and the tracking Lambda gets only the survey ID and dates.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

export const functionNames = ["response", "tracking"];

function settingsFrom(buildData, buildId) {
  const { surveyId, opensAt, closesAt } = buildData.settings;
  return { buildId, surveyId, opensAt, closesAt };
}

function currentBuildId() {
  if (process.env.BUILD_ID) return process.env.BUILD_ID;
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
}

/**
 * Builds both bundles into outdir and returns the path of each.
 * @returns {Promise<Record<string, string>>}
 */
export async function buildFunctions(outdir, buildData, buildId) {
  const settings = settingsFrom(buildData, buildId);
  /** @type {Record<string, string>} */
  const outputs = {};

  for (const name of functionNames) {
    const define = { __SURVEY_SETTINGS__: JSON.stringify(settings) };
    // Only the response Lambda routes answers, so only it receives the compiled survey.
    if (name === "response") define.__COMPILED_SURVEY__ = JSON.stringify(buildData.compiled);

    const outfile = join(outdir, name, "index.mjs");
    await build({
      entryPoints: [`functions/${name}/handler.ts`],
      outfile,
      bundle: true,
      platform: "node",
      target: "node24",
      format: "esm",
      minify: true,
      sourcemap: false,
      legalComments: "none",
      define,
      // Some AWS SDK dependencies use require(), which an ES module bundle needs to provide.
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
      logLevel: "warning",
    });

    const info = { name, buildId, surveyId: settings.surveyId, fingerprint: name === "response" ? buildData.compiled.fingerprint : null };
    writeFileSync(join(outdir, name, "build-info.json"), `${JSON.stringify(info, null, 2)}\n`);
    outputs[name] = outfile;
  }

  return outputs;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const buildData = JSON.parse(readFileSync(".build-data/build-data.json", "utf8"));
  const outdir = "dist/functions";
  mkdirSync(outdir, { recursive: true });
  const outputs = await buildFunctions(outdir, buildData, currentBuildId());
  for (const [name, path] of Object.entries(outputs)) console.log(`${name}: ${path}`);
}
