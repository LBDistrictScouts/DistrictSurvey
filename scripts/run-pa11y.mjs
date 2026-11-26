// Starts the local server on its own port, runs pa11y-ci against it, then stops it.
import { spawn } from "node:child_process";

const port = "8789";
const server = spawn("yarn", ["tsx", "functions/local/server.ts", "--static", "out", "--port", port], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, LOCAL_STORE: "memory", LOCAL_NOW: "2027-03-14T12:00:00Z" } });

await new Promise((resolve, reject) => {
  server.stdout.on("data", (chunk) => String(chunk).includes("Survey APIs on") && resolve());
  server.on("exit", (code) => reject(new Error(`The local server stopped with ${code}`)));
});

const checks = spawn("yarn", ["pa11y-ci", "--config", ".pa11yci.cjs"], { stdio: "inherit", env: { ...process.env, PA11Y_BASE_URL: `http://localhost:${port}` } });
checks.on("exit", (code) => {
  server.kill("SIGTERM");
  process.exitCode = code ?? 1;
});
