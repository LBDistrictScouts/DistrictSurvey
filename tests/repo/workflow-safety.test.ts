import { readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";

type Job = { "runs-on"?: string; environment?: string; permissions?: Record<string, string>; steps?: { uses?: string; run?: string }[] };
type Workflow = { on: Record<string, unknown>; permissions?: Record<string, string>; jobs: Record<string, Job> };

const directory = ".github/workflows";
const workflows = Object.fromEntries(readdirSync(directory).filter((name) => name.endsWith(".yml")).map((name) => [name, parse(readFileSync(`${directory}/${name}`, "utf8")) as Workflow]));
const triggers = (workflow: Workflow) => Object.keys(workflow.on);

describe("workflow safety", () => {
  it("[G27] no workflow uses pull_request_target", () => {
    for (const [name, workflow] of Object.entries(workflows)) expect(triggers(workflow), name).not.toContain("pull_request_target");
  });

  it("[G27] every job a pull request can start runs on a GitHub-hosted runner", () => {
    for (const [name, workflow] of Object.entries(workflows)) {
      if (!triggers(workflow).includes("pull_request")) continue;
      for (const [id, job] of Object.entries(workflow.jobs)) expect(job["runs-on"], `${name} ${id}`).toMatch(/^ubuntu-\d/);
    }
  });

  it("[G27] only deploy.yml uses the cluster runner, and pull requests cannot start it", () => {
    for (const [name, workflow] of Object.entries(workflows)) {
      for (const job of Object.values(workflow.jobs)) {
        if (job["runs-on"]?.includes("SURVEY_RUNNER_LABEL")) {
          expect(name).toBe("deploy.yml");
          expect(triggers(workflow)).not.toContain("pull_request");
        }
      }
    }
    expect(workflows["deploy.yml"]!.jobs.deploy!["runs-on"]).toBe("${{ vars.SURVEY_RUNNER_LABEL }}");
  });

  it("[G27] deploys use short-lived credentials in a GitHub environment, and production needs a tag", () => {
    const deploy = workflows["deploy.yml"]!;
    expect(deploy.jobs.deploy!.permissions?.["id-token"]).toBe("write");
    expect(deploy.jobs.deploy!.environment).toContain("inputs.environment");
    const steps = deploy.jobs.deploy!.steps ?? [];
    expect(steps.some((step) => step.uses?.startsWith("aws-actions/configure-aws-credentials@"))).toBe(true);
    expect(steps[0]!.run).toContain("Production deploys must run on a v* tag");
    expect(JSON.stringify(workflows)).not.toMatch(/aws-access-key-id|AWS_SECRET_ACCESS_KEY/);
  });

  it("every workflow starts read-only, and every action is pinned to a commit", () => {
    const actions = [readFileSync(".github/actions/setup/action.yml", "utf8"), ...readdirSync(directory).map((name) => readFileSync(`${directory}/${name}`, "utf8"))].join("\n");
    for (const [name, workflow] of Object.entries(workflows)) expect(workflow.permissions, name).toEqual({ contents: "read" });
    for (const match of actions.matchAll(/uses:\s*([^\s]+)/g)) {
      if (match[1]!.startsWith("./")) continue;
      expect(match[1], "pin actions to a full commit SHA").toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it("pull requests get no secrets", () => {
    expect(readFileSync(`${directory}/ci.yml`, "utf8")).not.toMatch(/\$\{\{\s*secrets\./);
  });
});
