// node scripts/externalize-scripts.mjs <export directory> [prefix]
//
// The Content Security Policy allows scripts from 'self' only, so Next.js bootstrap, Flight payload
// and theme scripts written inline into the export are moved into files. Execution order is kept by
// replacing each inline script with a synchronous script tag in the same place.
// Adapted from externalizeScripts in district-site/scripts/build-deployment.mjs.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function htmlFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${join(directory, entry.name)}`);
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await htmlFiles(path)));
    else if (path.endsWith(".html")) result.push(path);
  }
  return result;
}

/** Replaces each inline script with one served from `${prefix}/{sha256}.js`, returning the new HTML and scripts. */
export function externalizeScripts(html, prefix = "/_inline") {
  const scripts = [];
  const result = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, attributes, body) => {
    if (/\bsrc\s*=/i.test(attributes) || !body.trim()) return tag;
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
    if (type && !["text/javascript", "application/javascript", "module"].includes(type)) return tag;
    const name = `${createHash("sha256").update(body).digest("hex")}.js`;
    scripts.push({ name, body });
    return `<script${attributes} src="${prefix}/${name}"></script>`;
  });
  return { html: result, scripts };
}

export async function externalizeExport(directory, prefix = "/_inline") {
  const target = join(directory, prefix.replace(/^\//, ""));
  await mkdir(target, { recursive: true });
  let count = 0;
  for (const path of await htmlFiles(directory)) {
    const { html, scripts } = externalizeScripts(await readFile(path, "utf8"), prefix);
    for (const script of scripts) await writeFile(join(target, script.name), script.body);
    await writeFile(path, html);
    count += scripts.length;
  }
  // Fail closed: no inline script may remain anywhere in the export.
  for (const path of await htmlFiles(directory)) {
    const remaining = externalizeScripts(await readFile(path, "utf8"), prefix).scripts.length;
    if (remaining > 0) throw new Error(`${path} still has ${remaining} inline scripts`);
  }
  return count;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [directory = "out", prefix = "/_inline"] = process.argv.slice(2);
  const count = await externalizeExport(directory, prefix);
  console.log(`Moved ${count} inline scripts into ${directory}${prefix}`);
}
