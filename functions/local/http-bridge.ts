// Turns Node HTTP requests into API Gateway HTTP API events, and serves a static export with the same
// clean addresses and security headers as the CloudFront distributions.
import { existsSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";
import type { Event, Result } from "../shared/http";

export async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export async function toEvent(request: IncomingMessage, path: string, originValue: string): Promise<Event> {
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, String(value)]));
  // CloudFront adds this header. The local server plays that part.
  headers["x-origin-verify"] = originValue;
  const routeKey = `${request.method} ${path}`;
  return {
    version: "2.0",
    routeKey,
    rawPath: path,
    rawQueryString: "",
    headers,
    body: await readRequestBody(request),
    isBase64Encoded: false,
    requestContext: { requestId: randomUUID(), routeKey, http: { method: request.method ?? "GET", path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "" } },
  } as unknown as Event;
}

export function writeResult(response: ServerResponse, result: Result, extraHeaders: Record<string, string> = {}): void {
  const headers: Record<string, string | string[]> = { ...(result.headers as Record<string, string>), ...extraHeaders };
  if (result.cookies?.length) headers["set-cookie"] = result.cookies;
  response.writeHead(result.statusCode ?? 200, headers);
  response.end(result.body ?? "");
}

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// The survey distribution's headers, from infra/terraform/cloudfront-survey.tf.
export function securityHeaders(path: string): Record<string, string> {
  const turnstile = path === "/survey" || path.startsWith("/survey.");
  const scripts = turnstile ? "'self' https://challenges.cloudflare.com" : "'self'";
  const frames = turnstile ? "frame-src https://challenges.cloudflare.com; " : "";
  return {
    "content-security-policy": `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; connect-src 'self'; ${frames}frame-ancestors 'none'; base-uri 'none'`,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
  };
}

/** Maps /survey to /survey.html, as infra/terraform/clean-urls.js does, then serves the file. */
export function serveStatic(directory: string, path: string, response: ServerResponse, headers: Record<string, string> = securityHeaders(path)): void {
  const safe = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, "");
  const candidates = safe.endsWith("/") ? [join(safe, "index.html")] : extname(safe) ? [safe] : [`${safe}.html`, join(safe, "index.html")];
  const found = candidates.map((candidate) => join(directory, candidate)).find((file) => file.startsWith(directory) && existsSync(file) && statSync(file).isFile());

  if (!found) {
    const notFound = join(directory, "404.html");
    response.writeHead(404, { "content-type": types[".html"]!, ...headers });
    response.end(existsSync(notFound) ? readFileSync(notFound) : "Not found");
    return;
  }

  response.writeHead(200, { "content-type": types[extname(found)] ?? "application/octet-stream", ...headers });
  response.end(readFileSync(found));
}
