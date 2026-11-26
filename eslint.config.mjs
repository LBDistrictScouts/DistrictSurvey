import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Screens use the wrappers in src/ui so AlignUI can be updated in one place.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/ui/**", "src/vendor/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/vendor/alignui/*", "@/components/ui/*", "**/vendor/alignui/**"], message: "Import AlignUI components through src/ui." },
        ],
      }],
    },
  },
  {
    // The response Lambda must never see invite UUIDs, so it cannot import tracking code, and the reverse.
    files: ["functions/response/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["../tracking/*", "**/functions/tracking/**"], message: "The response Lambda must not include tracking code." }] }] },
  },
  {
    files: ["functions/tracking/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["../response/*", "**/functions/response/**"], message: "The tracking Lambda must not include response code." }] }] },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "reports/**",
    "test-results/**",
    "playwright-report/**",
    ".stryker-tmp/**",
    "next-env.d.ts",
    // CommonJS, as pa11y-ci requires.
    ".pa11yci.cjs",
    // CloudFront Functions run in their own runtime, deployed by Terraform.
    "infra/**",
    // Vendored third-party source, kept unmodified.
    "src/vendor/**",
    // Generated from the OpenAPI files.
    "src/lib/contracts/types.ts",
  ]),
]);

export default eslintConfig;
