// Mutation tests for the code that decides who may save a response. The design requires a mutation
// score of at least 80% for signing.ts and s3-records.ts.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "yarn",
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts", related: false },
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: ["functions/shared/signing.ts", "functions/shared/s3-records.ts"],
  testFiles: ["tests/functions/**/*.test.ts"],
  coverageAnalysis: "perTest",
  thresholds: { high: 90, low: 80, break: 80 },
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  tempDirName: ".stryker-tmp",
};

export default config;
