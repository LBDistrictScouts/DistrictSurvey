// yarn survey:validate <survey.yaml> [--previous <last-year.yaml>] [--settings <settings.yaml>]
//
// Runs the survey engine's validator, then prints every question path and its length, or each
// problem with the question, rule and fix. Exits with 1 when the survey is not valid.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { surveySettingsSchema } from "@lbdistrictscouts/survey-engine/compiler";
import { validateSurvey } from "@lbdistrictscouts/survey-engine/validator";
import type { ValidationResult } from "@lbdistrictscouts/survey-engine";
import { parse } from "yaml";

export const usage = "Usage: yarn survey:validate <survey.yaml> [--previous <last-year.yaml>] [--settings <settings.yaml>]";

/** Formats a validation result as the text the command prints. */
export function report(file: string, result: ValidationResult): string {
  const lines: string[] = [];

  if (!result.ok) {
    lines.push(`${file} has ${result.issues.length} ${result.issues.length === 1 ? "problem" : "problems"}:`, "");
    for (const issue of result.issues) {
      lines.push(`  ${issue.questionId ? `Question ${issue.questionId}` : "Survey"} [${issue.rule}]`, `    ${issue.message}`, `    Fix: ${issue.fix}`, "");
    }
    return lines.join("\n");
  }

  const longest = Math.max(...result.paths.map((path) => path.questions.length));
  lines.push(`${file} is valid: ${result.compiled?.surveyId}, ${result.paths.length} question paths, the longest has ${longest} questions.`, `Fingerprint ${result.compiled?.fingerprint}`, "");

  for (const path of [...result.paths].sort((a, b) => a.tags.join(",").localeCompare(b.tags.join(",")))) {
    lines.push(`  ${String(path.questions.length).padStart(3)} questions  [${path.tags.join(", ")}]`, `      ${path.questions.join(" > ")}`);
  }
  return lines.join("\n");
}

export function run(argv: string[], read: (path: string) => string = (path) => readFileSync(path, "utf8")): { output: string; exitCode: number } {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, options: { previous: { type: "string" }, settings: { type: "string" } } });
  } catch (error) {
    return { output: `${error instanceof Error ? error.message : error}\n${usage}`, exitCode: 2 };
  }

  const [file] = parsed.positionals;
  if (!file || parsed.positionals.length > 1) return { output: usage, exitCode: 2 };

  try {
    const previous = parsed.values.previous ? read(parsed.values.previous) : undefined;
    const settings = parsed.values.settings ? surveySettingsSchema.parse(parse(read(parsed.values.settings))) : undefined;
    const result = validateSurvey(read(file), previous, settings);
    return { output: report(file, result), exitCode: result.ok ? 0 : 1 };
  } catch (error) {
    return { output: `Could not validate ${file}: ${error instanceof Error ? error.message : error}`, exitCode: 2 };
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { output, exitCode } = run(process.argv.slice(2));
  (exitCode === 0 ? console.log : console.error)(output);
  process.exitCode = exitCode;
}
