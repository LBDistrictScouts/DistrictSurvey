import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The checked paths in "Public code scope". docs/, README.md and review reports may name the district.
const checkedPaths = ["src", "functions", "infra/terraform", "scripts", "contracts", "examples", ".github/workflows"];
const skipped = new Set(["node_modules", ".terraform", "vendor"]);

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).filter((name) => !skipped.has(name) && !name.startsWith(".terraform")).flatMap((name) => files(join(path, name)));
}

// Search terms come from the DISTRICT_TERMS repository variable, comma separated, so the list itself is
// not public. These generic checks always run.
const terms = [
  ...(process.env.DISTRICT_TERMS ?? "").split(",").map((term) => term.trim()).filter(Boolean),
  "lbdscouts.org.uk",
];

describe("public code scope", () => {
  const scanned = checkedPaths.flatMap(files).filter((path) => !/\.(png|ico|woff2?)$/.test(path) && path !== "src/lib/contracts/types.ts" && !path.endsWith("README.md"));

  it("[G20] checked paths hold no district-specific values", () => {
    const found = scanned.flatMap((path) => {
      const text = readFileSync(path, "utf8").toLowerCase();
      return terms.filter((term) => text.includes(term.toLowerCase())).map((term) => `${path}: ${term}`);
    });
    expect(found).toEqual([]);
  });

  it("[G20] examples use example.org addresses only", () => {
    for (const path of scanned.filter((file) => file.startsWith("examples/") || file.startsWith("contracts/"))) {
      for (const match of readFileSync(path, "utf8").matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
        expect(match[1]!.endsWith("example.org") || ["json-schema.org", "github.com", "localhost", "www.w3.org"].includes(match[1]!) || match[1]!.endsWith(".amazonaws.com"), `${path}: ${match[0]}`).toBe(true);
      }
    }
  });

  it("scans every checked path", () => {
    expect(scanned.length).toBeGreaterThan(50);
  });
});
