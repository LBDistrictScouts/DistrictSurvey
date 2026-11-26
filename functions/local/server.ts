// yarn tsx functions/local/server.ts [--static out] [--port 8787]
//
// Runs the real Lambda code behind a local HTTP server, standing in for API Gateway and CloudFront.
// With --static it also serves the exported survey site, so the browser talks to one origin as it
// does in production. Without it, `next dev` on port 3000 calls this server directly.
import { createServer } from "node:http";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { createLocalLambdas } from "./lambdas";
import { serveStatic, toEvent, writeResult } from "./http-bridge";

const { values } = parseArgs({ options: { static: { type: "string" }, port: { type: "string", default: process.env.PORT ?? "8787" }, "results-domain": { type: "string", default: "localhost:8788" } } });
const port = Number(values.port);
const staticDirectory = values.static ? resolve(values.static) : undefined;
const devOrigin = "http://localhost:3000";

const lambdas = await createLocalLambdas(values["results-domain"]!);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  const cors = { "access-control-allow-origin": devOrigin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST" };

  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return;
  }

  if (url.pathname.startsWith("/api/v1/tracking/")) return writeResult(response, await lambdas.tracking(await toEvent(request, url.pathname, lambdas.originValue)), cors);
  if (url.pathname.startsWith("/api/v1/responses/")) return writeResult(response, await lambdas.response(await toEvent(request, url.pathname, lambdas.originValue)), cors);

  // Test helpers. They exist only in the local server, never behind CloudFront.
  if (url.pathname === "/__local/messages") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(lambdas.messages));
    return;
  }

  // Stands in for Cloudflare's siteverify when TURNSTILE_VERIFY_URL points here. LOCAL_TURNSTILE=fail rejects every token.
  if (url.pathname === "/__local/siteverify") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ success: process.env.LOCAL_TURNSTILE !== "fail", hostname: "localhost" }));
    return;
  }

  if (staticDirectory) return serveStatic(staticDirectory, url.pathname, response);
  response.writeHead(404);
  response.end();
});

server.listen(port, () => {
  console.log(`Survey APIs on http://localhost:${port}${staticDirectory ? `, serving ${staticDirectory}` : ""} (survey ${lambdas.buildData.surveyId}, ${process.env.LOCAL_STORE === "memory" ? "memory" : "Moto"} storage)`);
});
