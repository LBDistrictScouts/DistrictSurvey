import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Runs the CloudFront Function in a sandbox, as CloudFront would.
const source = readFileSync("infra/terraform/clean-urls.js", "utf8");
const handler = runInNewContext(`${source}; handler`) as (event: { request: { uri: string } }) => { uri: string };
const rewrite = (uri: string) => handler({ request: { uri } }).uri;

describe("clean addresses", () => {
  it("maps page addresses to exported HTML files", () => {
    expect(rewrite("/survey")).toBe("/survey.html");
    expect(rewrite("/invite/")).toBe("/invite.html");
    expect(rewrite("/surveys/example-2027")).toBe("/surveys/example-2027.html");
  });

  it("leaves the root and files alone", () => {
    expect(rewrite("/")).toBe("/");
    expect(rewrite("/_next/static/chunk.js")).toBe("/_next/static/chunk.js");
    expect(rewrite("/results-data/example-2027/current.json")).toBe("/results-data/example-2027/current.json");
  });
});
