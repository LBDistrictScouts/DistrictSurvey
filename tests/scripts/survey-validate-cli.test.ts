import { readFileSync } from "node:fs";
import { run } from "../../scripts/survey-validate";

const files: Record<string, string> = {
  "survey.yaml": readFileSync("examples/survey.example.yaml", "utf8"),
  "second.yaml": readFileSync("examples/survey-second-year.example.yaml", "utf8"),
  "settings.yaml": readFileSync("examples/settings.example.yaml", "utf8"),
  "broken.yaml": readFileSync("examples/survey.example.yaml", "utf8").replace("showIf: { all: [network] }", "showIf: { all: [netwrok] }"),
};
const read = (path: string) => {
  if (!(path in files)) throw new Error(`ENOENT ${path}`);
  return files[path]!;
};

describe("yarn survey:validate", () => {
  it("[G17] prints every path with its question count", () => {
    const { output, exitCode } = run(["survey.yaml", "--settings", "settings.yaml"], read);
    expect(exitCode).toBe(0);
    expect(output).toMatch(/is valid: example-2027, 18 question paths, the longest has 9 questions/);
    expect(output).toContain("age-group > section > enjoy > favourite");
    expect(output).toMatch(/Fingerprint sha256:[0-9a-f]{64}/);
  });

  it("[G17] names the question, rule and fix when a survey is invalid", () => {
    const { output, exitCode } = run(["broken.yaml"], read);
    expect(exitCode).toBe(1);
    expect(output).toContain("Question network-activities [unknown-tag]");
    expect(output).toContain("Fix: Check the spelling");
  });

  it("[G17] checks reused question IDs against the previous year", () => {
    expect(run(["second.yaml", "--previous", "survey.yaml"], read).exitCode).toBe(0);
    const changed: Record<string, string> = { ...files, "changed.yaml": files["second.yaml"]!.replace("How supported do you feel in your role?", "How supported are you?") };
    const result = run(["changed.yaml", "--previous", "survey.yaml"], (path) => changed[path]!);
    expect(result.output).toContain("[changed-question]");
  });

  it("explains how to use it", () => {
    expect(run([], read)).toMatchObject({ exitCode: 2 });
    expect(run(["a", "b"], read).output).toContain("Usage:");
    expect(run(["--nope"], read).exitCode).toBe(2);
    expect(run(["missing.yaml"], read).output).toContain("Could not validate missing.yaml");
  });
});
