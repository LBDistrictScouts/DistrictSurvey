// yarn tsx functions/local/results-proxy.ts [--data <dir>] [--site <data-viz out>] [--port 8788]
//
// Stands in for the results CloudFront distribution: /api/results-access issues signed cookies through
// the real tracking Lambda code, and /results-data/* is served only with valid cookies, checked the
// way CloudFront checks them.
import { createPublicKey, createVerify, type KeyObject } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { join, normalize, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createLocalLambdas, localKeyPairId } from "./lambdas";
import { serveStatic, toEvent, writeResult } from "./http-bridge";

function cookies(request: IncomingMessage): Map<string, string> {
  return new Map((request.headers.cookie ?? "").split(";").map((part) => part.trim().split("=")).filter((pair) => pair.length >= 2).map(([name, ...value]) => [name!, value.join("=")]));
}

const fromCloudFront = (text: string) => Buffer.from(text.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");

/** True when the request carries cookies whose policy is signed by our key and covers this URL now. */
export function cookiesAllow(request: IncomingMessage, url: URL, publicKey: KeyObject, now = Date.now()): boolean {
  const jar = cookies(request);
  const policy = jar.get("CloudFront-Policy");
  const signature = jar.get("CloudFront-Signature");
  if (!policy || !signature || jar.get("CloudFront-Key-Pair-Id") !== localKeyPairId) return false;

  const policyBytes = fromCloudFront(policy);
  if (!createVerify("RSA-SHA1").update(policyBytes).verify(publicKey, fromCloudFront(signature))) return false;

  const statement = JSON.parse(policyBytes.toString()).Statement?.[0];
  const resource = String(statement?.Resource ?? "");
  const expires = Number(statement?.Condition?.DateLessThan?.["AWS:EpochTime"] ?? 0) * 1000;
  const prefix = resource.endsWith("*") ? resource.slice(0, -1) : resource;
  return now < expires && `https://${url.host}${url.pathname}`.startsWith(prefix);
}

const isMain = process.argv[1] && resolve(process.argv[1]).endsWith("results-proxy.ts");

if (isMain) {
  const { values } = parseArgs({ options: { port: { type: "string", default: "8788" }, data: { type: "string", default: ".local/results-data" }, site: { type: "string" } } });
  const port = Number(values.port);
  const dataDirectory = resolve(values.data!);
  const lambdas = await createLocalLambdas(`localhost:${port}`);
  const publicKey = createPublicKey(await lambdas.secrets("cloudfront-cookie-private-key"));

  createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://localhost:${port}`);

    if (url.pathname === "/api/results-access" && request.method === "POST") {
      return writeResult(response, await lambdas.tracking(await toEvent(request, url.pathname, lambdas.originValue)));
    }

    if (url.pathname.startsWith("/results-data/")) {
      if (!cookiesAllow(request, url, publicKey)) {
        response.writeHead(403, { "content-type": "text/plain" });
        response.end("Forbidden");
        return;
      }
      const file = join(dataDirectory, normalize(url.pathname.replace("/results-data/", "")).replace(/^(\.\.[/\\])+/, ""));
      if (!file.startsWith(dataDirectory) || !existsSync(file)) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "application/json", "cache-control": url.pathname.endsWith("current.json") ? "max-age=60" : "max-age=31536000, immutable" });
      response.end(readFileSync(file));
      return;
    }

    if (values.site) return serveStatic(resolve(values.site), url.pathname, response, {});
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("Results proxy. Pass --site with a data-viz export to serve its pages.");
  }).listen(port, () => console.log(`Results proxy on http://localhost:${port}, data from ${dataDirectory}`));
}
