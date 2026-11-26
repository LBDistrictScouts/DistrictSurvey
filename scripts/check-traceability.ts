// yarn traceability [--report <file>]...
//
// Fails when a goal assigned to this repository has no passing test tagged with its ID, such as [G7].
// Reads Vitest and Playwright JSON reports, and `terraform test` output where run blocks are named
// after their goal, such as run "g18_every_alarm_notifies".
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

/** Goals assigned to DistrictSurvey in "Goal traceability" in the design. */
export const assignedGoals = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G14", "G15", "G17", "G18", "G20", "G21", "G25", "G27"];

export const defaultReports = ["reports/vitest.json", "reports/playwright.json", "reports/playwright-a11y.json", "reports/terraform-test.txt"];

type VitestReport = { testResults: { assertionResults: { fullName?: string; title: string; ancestorTitles?: string[]; status: string }[] }[] };
type PlaywrightSuite = { title: string; specs?: { title: string; ok: boolean; tests?: { status?: string }[] }[]; suites?: PlaywrightSuite[] };

function goalsIn(title: string): string[] {
  return [...title.matchAll(/\[(G\d+)\]/g)].map((match) => match[1]!);
}

export function passingTitles(path: string, text: string): string[] {
  if (path.endsWith(".txt")) {
    // terraform test prints `run "g18_alarm_actions"... pass`.
    return [...text.matchAll(/run "(g\d+)_[^"]*"\.\.\. pass/gi)].map((match) => `[${match[1]!.toUpperCase()}]`);
  }

  const data = JSON.parse(text);
  if ("testResults" in data) {
    return (data as VitestReport).testResults.flatMap((file) => file.assertionResults.filter((test) => test.status === "passed").map((test) => [...(test.ancestorTitles ?? []), test.title].join(" ")));
  }

  const titles: string[] = [];
  const walk = (suite: PlaywrightSuite, parents: string[]) => {
    for (const spec of suite.specs ?? []) if (spec.ok && (spec.tests ?? []).every((test) => test.status !== "skipped")) titles.push([...parents, spec.title].join(" "));
    for (const child of suite.suites ?? []) walk(child, [...parents, child.title]);
  };
  for (const suite of (data as { suites: PlaywrightSuite[] }).suites ?? []) walk(suite, [suite.title]);
  return titles;
}

export function missingGoals(titles: string[], goals = assignedGoals): string[] {
  const covered = new Set(titles.flatMap(goalsIn));
  return goals.filter((goal) => !covered.has(goal));
}

export function run(argv: string[]): { output: string; exitCode: number } {
  const { values } = parseArgs({ args: argv, options: { report: { type: "string", multiple: true } } });
  const reports = values.report ?? defaultReports;
  const missingFiles = reports.filter((path) => !existsSync(path));
  if (missingFiles.length > 0) return { output: `Missing test reports: ${missingFiles.join(", ")}`, exitCode: 1 };

  const titles = reports.flatMap((path) => passingTitles(path, readFileSync(path, "utf8")));
  const missing = missingGoals(titles);
  if (missing.length > 0) return { output: `No passing test is tagged with ${missing.join(", ")}.`, exitCode: 1 };
  return { output: `Every assigned goal has a passing test: ${assignedGoals.join(", ")}.`, exitCode: 0 };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { output, exitCode } = run(process.argv.slice(2));
  (exitCode === 0 ? console.log : console.error)(output);
  process.exitCode = exitCode;
}
