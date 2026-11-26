// yarn test:stack
//
// The pull request test stack: Moto in Docker, the exported site and the real Lambda code behind the
// local server, then the browser and accessibility tests. DistrictWorkflow is not run; tests read
// completion messages from the local server instead.
import { execFileSync, spawnSync } from "node:child_process";

const container = "district-survey-moto";
const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: "inherit" });

function motoRunning(): boolean {
  return spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", container], { encoding: "utf8" }).stdout.trim() === "true";
}

if (!process.env.AWS_ENDPOINT_URL && !motoRunning()) {
  // The same image as DistrictWorkflow's infrastructure/compose.yaml.
  run("docker", ["run", "--rm", "-d", "--name", container, "-p", "127.0.0.1:4566:4566", "-e", "MOTO_PORT=4566", "motoserver/moto:5.2.1"]);
}

try {
  run("yarn", ["build"]);
  run("yarn", ["test:e2e"]);
  run("yarn", ["test:a11y"]);
} finally {
  if (!process.env.KEEP_MOTO && motoRunning()) spawnSync("docker", ["stop", container], { stdio: "inherit" });
}
