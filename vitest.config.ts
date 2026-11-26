import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The same aliases as tsconfig.json. AlignUI's own imports resolve to its vendored copy.
    alias: [
      { find: /^@\/components\/ui\/(.*)$/, replacement: path("./src/vendor/alignui/$1") },
      { find: /^@\/utils\/tv$/, replacement: path("./src/ui/lib/tv.ts") },
      { find: /^@\/utils\/(.*)$/, replacement: path("./src/vendor/alignui/utils/$1") },
      { find: /^@\/tailwind\.config$/, replacement: path("./src/vendor/alignui/tailwind-tokens.ts") },
      { find: /^@\/(.*)$/, replacement: path("./src/$1") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["functions/**/*.ts", "src/lib/**/*.ts", "src/components/**/*.tsx", "src/ui/**/*.tsx", "src/app/**/*.tsx"],
      exclude: [
        // Vendored AlignUI source is excluded. Its src/ui wrappers are included.
        "src/vendor/**",
        // Generated from the OpenAPI files.
        "src/lib/contracts/types.ts",
        // Deployed and local entry points, covered by the stack and end-to-end tests.
        "functions/local/**",
        "functions/*/handler.ts",
        // Server-rendered pages are covered by the end-to-end tests.
        "src/app/**",
      ],
      thresholds: {
        "functions/**": { lines: 95, branches: 95 },
        "src/lib/**": { lines: 95, branches: 90 },
        "src/components/**": { lines: 90, branches: 85 },
        "src/ui/**": { lines: 90, branches: 85 },
      },
    },
  },
});
