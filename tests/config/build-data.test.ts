import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BuildDataError, checkBuildData, exampleBuildData, fetchBuildData, loadBuildData, logoPath, readBuildData, writeBuildData } from "@/lib/config/build-data";
import { pageWindowState, siteSettings, turnstileSiteKey, formatDate } from "@/lib/config/site";

const example = exampleBuildData();
const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe("build data", () => {
  it("pull request builds use the made-up examples", async () => {
    expect((await loadBuildData({})).surveyId).toBe("example-2027");
    expect(example.compiled.fingerprint).toMatch(/^sha256:/);
  });

  it("deployed builds must use DistrictStatistics, and fail without it", async () => {
    await expect(loadBuildData({ SURVEY_ENVIRONMENT: "prod" })).rejects.toThrow("Missing DATA_CORE_URL, SURVEY_ID, SURVEY_BUILD_TOKEN");
    await expect(loadBuildData({ SURVEY_ENVIRONMENT: "test", SURVEY_DATA_SOURCE: "example" })).rejects.toThrow("test builds cannot use example data");
    await expect(loadBuildData({ SURVEY_DATA_SOURCE: "elsewhere" })).rejects.toThrow("Unknown SURVEY_DATA_SOURCE");
    await expect(loadBuildData({ SURVEY_ENVIRONMENT: "prod", DATA_CORE_URL: "https://data-core.example.org", SURVEY_ID: "example-2027", SURVEY_BUILD_TOKEN: "t" }, async () => { throw new Error("down"); })).rejects.toThrow("DistrictStatistics is unavailable");
  });

  it("fetches with the build token and checks what comes back", async () => {
    let request: { url: string; init: RequestInit } | undefined;
    const fetcher = async (url: string, init: RequestInit) => ((request = { url, init }), new Response(JSON.stringify(example), { status: 200 }));
    expect((await fetchBuildData("https://data-core.example.org/", "example-2027", "token", fetcher)).surveyId).toBe("example-2027");
    expect(request!.url).toBe("https://data-core.example.org/api/v1/surveys/example-2027/build-data");
    expect((request!.init.headers as Record<string, string>).authorization).toBe("Bearer token");

    await expect(fetchBuildData("https://x.example.org", "example-2027", "t", reply(403, {}))).rejects.toThrow("returned 403");
    await expect(fetchBuildData("https://x.example.org", "other", "t", reply(200, example))).rejects.toThrow("not other");
  });

  it("refuses invalid data, mismatched surveys and a fingerprint that does not match the questions", () => {
    expect(() => checkBuildData({ ...example, versionNumber: 0 })).toThrow(BuildDataError);
    expect(() => checkBuildData({ ...example, settings: { ...example.settings, surveyId: "other" } })).toThrow("different surveys");
    expect(() => checkBuildData({ ...example, compiled: { ...example.compiled, fingerprint: `sha256:${"0".repeat(64)}` } })).toThrow("fingerprint");
  });

  it("writes the data and logos for the site and Lambda builds, and reads them back", () => {
    const directory = mkdtempSync(join(tmpdir(), "build-data-"));
    writeBuildData(example, join(directory, "data", "build-data.json"), join(directory, "brand"));
    expect(readFileSync(join(directory, "brand", "logo-light.svg"), "utf8")).toContain("<svg");
    expect(readBuildData(join(directory, "data", "build-data.json")).compiled.fingerprint).toBe(example.compiled.fingerprint);
    expect(readBuildData(join(directory, "missing.json")).surveyId).toBe("example-2027");
    expect(logoPath(example, "dark")).toBe("/brand/logo-dark.svg");
    expect(existsSync(join(directory, "brand", "logo-dark.svg"))).toBe(true);
  });
});

describe("site settings", () => {
  it("passes the browser only what it needs", () => {
    expect(Object.keys(siteSettings(example)).sort()).toEqual(["closesAt", "helpContact", "opensAt", "organisationName", "privacyContact", "resultsUrl", "surveyId"]);
  });

  it("uses Cloudflare's test key outside deployed builds", () => {
    expect(turnstileSiteKey({})).toBe("1x00000000000000000000AA");
    expect(turnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAA", SURVEY_ENVIRONMENT: "prod" })).toBe("0x4AAA");
    expect(() => turnstileSiteKey({ SURVEY_ENVIRONMENT: "prod" })).toThrow("required");
  });

  it("[G21] offers the survey from opening until closing", () => {
    const window = { opensAt: "2027-03-01T09:00:00Z", closesAt: "2027-03-31T22:59:00Z" };
    expect(pageWindowState(window, Date.parse("2027-02-28T00:00:00Z"))).toBe("before");
    expect(pageWindowState(window, Date.parse("2027-03-31T22:58:00Z"))).toBe("open");
    expect(pageWindowState(window, Date.parse("2027-03-31T22:59:00Z"))).toBe("closed");
    expect(formatDate("2027-03-31T22:59:00Z")).toBe("31 March 2027");
  });
});
