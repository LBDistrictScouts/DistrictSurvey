import { generateKeyPairSync, createVerify } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import type { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { SSMClient } from "@aws-sdk/client-ssm";
import { controlParameterName, controlsCacheMilliseconds, createSsmControls, fixedControls } from "../../functions/shared/controls";
import { requiredEnv } from "../../functions/shared/environment";
import { checkOrigin, createHandler, errorStatus, json, readBody, ApiError } from "../../functions/shared/http";
import { setLogWriter } from "../../functions/shared/logger";
import { createCloudWatchMetrics, metricNamespace } from "../../functions/shared/metrics";
import { createFileSecretSource, createSecretsManagerSource, parseOriginValues, secretId } from "../../functions/shared/secrets";
import { createCookieSigner } from "../../functions/tracking/cookies";
import { z } from "zod";
import { apiEvent } from "./helpers";

type Sent = { name: string; input: Record<string, unknown> };

function recordingClient<T>(reply: (command: Sent) => unknown): { client: T; sent: Sent[] } {
  const sent: Sent[] = [];
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const entry = { name: command.constructor.name, input: command.input };
      sent.push(entry);
      return reply(entry);
    },
  };
  return { client: client as T, sent };
}

describe("controls", () => {
  it("[G21] reads the four switches, treating anything but true as off, and caches for 30 seconds", async () => {
    let time = 0;
    const { client, sent } = recordingClient<SSMClient>(() => ({
      Parameters: [
        { Name: "/district-survey/test/controls/open", Value: "true" },
        { Name: "/district-survey/test/controls/tracked", Value: "TRUE" },
        { Name: "/district-survey/test/controls/survey", Value: "true" },
      ],
    }));
    const controls = createSsmControls(client, "test", () => time);

    expect(await controls()).toEqual({ open: true, tracked: false, survey: true, resultsCookies: false });
    expect(sent[0]!.input.Names).toEqual(["open", "tracked", "survey", "results-cookies"].map((name) => `/district-survey/test/controls/${name}`));

    time = controlsCacheMilliseconds - 1;
    await controls();
    expect(sent).toHaveLength(1);
    time = controlsCacheMilliseconds;
    await controls();
    expect(sent).toHaveLength(2);
  });

  it("treats a response with no parameters as everything off", async () => {
    const { client } = recordingClient<SSMClient>(() => ({}));
    expect(await createSsmControls(client, "prod")()).toEqual({ open: false, tracked: false, survey: false, resultsCookies: false });
    expect(controlParameterName("prod", "resultsCookies")).toBe("/district-survey/prod/controls/results-cookies");
    expect(await fixedControls()()).toEqual({ open: true, tracked: true, survey: true, resultsCookies: true });
  });
});

describe("secrets", () => {
  it("reads each secret once per 5 minutes, and retries after a failure", async () => {
    let time = 0;
    let fail = true;
    const { client, sent } = recordingClient<SecretsManagerClient>((command) => {
      if (fail) {
        fail = false;
        throw new Error("throttled");
      }
      return { SecretString: `value of ${String(command.input.SecretId)}` };
    });
    const secrets = createSecretsManagerSource(client, "test", () => time);

    await expect(secrets("file-name-key")).rejects.toThrow("throttled");
    await Promise.resolve();
    expect(await secrets("file-name-key")).toBe("value of /district-survey/test/file-name-key");
    expect(await secrets("file-name-key")).toBe("value of /district-survey/test/file-name-key");
    expect(sent).toHaveLength(2);

    time = 5 * 60 * 1000;
    await secrets("file-name-key");
    expect(sent).toHaveLength(3);
    expect(secretId("prod", "origin-header")).toBe("/district-survey/prod/origin-header");
  });

  it("refuses empty secrets", async () => {
    const { client } = recordingClient<SecretsManagerClient>(() => ({}));
    await expect(createSecretsManagerSource(client, "test")("x")).rejects.toThrow("Secret x is empty");
  });

  it("reads the local secrets file", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "secrets-")), "local.secrets.json");
    writeFileSync(path, JSON.stringify({ "file-name-key": "abc" }));
    const secrets = createFileSecretSource(path);
    expect(await secrets("file-name-key")).toBe("abc");
    await expect(secrets("missing")).rejects.toThrow("missing");
  });

  it("accepts a list of origin header values, so one can be rotated", () => {
    expect(parseOriginValues(JSON.stringify(["a".repeat(32), "b".repeat(40)]))).toHaveLength(2);
    for (const bad of ["[]", '"single"', JSON.stringify(["short"]), JSON.stringify([42])]) expect(() => parseOriginValues(bad)).toThrow();
  });
});

describe("metrics", () => {
  it("publishes a count of 1 with no dimensions, and ignores failures", async () => {
    const { client, sent } = recordingClient<CloudWatchClient>(() => ({}));
    await createCloudWatchMetrics(client, "test")("TurnstileRejected");
    expect(sent[0]!.input).toEqual({ Namespace: "DistrictSurvey/test", MetricData: [{ MetricName: "TurnstileRejected", Value: 1, Unit: "Count" }] });
    expect(metricNamespace("prod")).toBe("DistrictSurvey/prod");

    const failing = recordingClient<CloudWatchClient>(() => {
      throw new Error("down");
    });
    await expect(createCloudWatchMetrics(failing.client, "test")("CompletionSendFailed")).resolves.toBeUndefined();
  });
});

describe("http", () => {
  it("checks the CloudFront origin header against every accepted value", () => {
    expect(() => checkOrigin(apiEvent("POST /x", {}, { "x-origin-verify": "b".repeat(40) }), ["a".repeat(40), "b".repeat(40)])).not.toThrow();
    expect(() => checkOrigin(apiEvent("POST /x", {}, { "x-origin-verify": "b".repeat(39) }), ["b".repeat(40)])).toThrow(ApiError);
    expect(() => checkOrigin(apiEvent("POST /x", {}, {}), [""])).toThrow(ApiError);
    expect(() => checkOrigin({ ...apiEvent("POST /x", {}), headers: undefined } as never, ["b".repeat(40)])).toThrow(ApiError);
  });

  it("reads base64 bodies and refuses empty ones", () => {
    const schema = z.strictObject({ token: z.string() });
    const event = { ...apiEvent("POST /x", ""), body: Buffer.from(JSON.stringify({ token: "t" })).toString("base64"), isBase64Encoded: true };
    expect(readBody(event, schema, "invalid_link")).toEqual({ token: "t" });
    expect(() => readBody({ ...event, body: undefined, isBase64Encoded: false }, schema, "invalid_link")).toThrow(ApiError);
  });

  it("sets no-store on every response and lists the status of each error code", () => {
    expect(json(200, { status: "ok" }).headers).toMatchObject({ "cache-control": "no-store" });
    expect(Object.keys(errorStatus).sort()).toEqual(["already_completed", "invalid_answers", "invalid_link", "rate_limited", "survey_closed", "temporarily_unavailable", "verification_failed", "version_changed"]);
  });

  it("reports an unknown request ID and logs its timing band", async () => {
    const lines: string[] = [];
    setLogWriter((line) => lines.push(line));
    let time = 0;
    const handler = createHandler({ "POST /slow": async () => ((time = 2500), { result: json(200, {}) }) }, "b", async () => ["v".repeat(40)], () => time);
    await handler({ ...apiEvent("POST /slow", {}, { "x-origin-verify": "v".repeat(40) }), requestContext: undefined } as never);
    setLogWriter((line) => console.log(line));
    expect(JSON.parse(lines[0]!)).toEqual({ requestId: "unknown", route: "POST /slow", outcome: "ok", responseTimeBand: ">=2s", buildId: "b" });
  });
});

describe("environment", () => {
  it("fails at start-up when a required variable is missing", () => {
    process.env.SURVEY_TEST_VALUE = "set";
    expect(requiredEnv("SURVEY_TEST_VALUE")).toBe("set");
    delete process.env.SURVEY_TEST_VALUE;
    expect(() => requiredEnv("SURVEY_TEST_VALUE")).toThrow("SURVEY_TEST_VALUE is not set");
  });
});

describe("CloudFront cookies", () => {
  it("[G10] signs a custom policy for one survey's results data, with secure cookie attributes", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    const sign = createCookieSigner("results.example.org", "K2EXAMPLE", async () => pem);
    const expiresAt = new Date("2027-03-21T15:30:00Z");

    const cookies = await sign("example-2027", expiresAt);
    expect(cookies.map((cookie) => cookie.split("=")[0])).toEqual(["CloudFront-Policy", "CloudFront-Signature", "CloudFront-Key-Pair-Id"]);
    for (const cookie of cookies) expect(cookie).toContain("; Path=/results-data/; Expires=Sun, 21 Mar 2027 15:30:00 GMT; Secure; HttpOnly; SameSite=Lax");

    const value = (name: string) => cookies.find((cookie) => cookie.startsWith(`${name}=`))!.split(";")[0]!.slice(name.length + 1);
    const fromCloudFront = (text: string) => Buffer.from(text.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");
    const policy = fromCloudFront(value("CloudFront-Policy"));
    expect(JSON.parse(policy.toString())).toEqual({ Statement: [{ Resource: "https://results.example.org/results-data/example-2027/*", Condition: { DateLessThan: { "AWS:EpochTime": 1805643000 } } }] });
    expect(createVerify("RSA-SHA1").update(policy).verify(publicKey, fromCloudFront(value("CloudFront-Signature")))).toBe(true);
    expect(value("CloudFront-Key-Pair-Id")).toBe("K2EXAMPLE");
  });
});
