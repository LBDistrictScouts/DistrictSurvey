// yarn dev:all
//
// Starts the survey site with `next dev` and the local Lambda server against DistrictWorkflow's
// shared Moto on port 4566. Start Moto first with `yarn aws:local:up` in DistrictWorkflow, or set
// LOCAL_STORE=memory to run without it.
import { spawn } from "node:child_process";

const children = [
  spawn("yarn", ["tsx", "functions/local/server.ts"], { stdio: "inherit", env: { ...process.env } }),
  spawn("yarn", ["tsx", "functions/local/results-proxy.ts"], { stdio: "inherit", env: { ...process.env } }),
  spawn("yarn", ["dev"], { stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_API_BASE: "http://localhost:8787", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" } }),
];

const stop = () => {
  for (const child of children) child.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", (code) => {
  if (code) {
    stop();
    process.exitCode = code;
  }
});
