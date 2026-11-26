// yarn tsx scripts/sign-test-link.ts --env <local|test> [--uuid <uuid>] [--base-url <url>]
//
// A Phase 3 stand-in for DistrictWorkflow: signs a tracked link with the environment's tracked link
// key and prints it. Local reads .local/local.secrets.json; test reads Secrets Manager.
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createFileSecretSource, createSecretsManagerSource, type SecretSource } from "../functions/shared/secrets";
import { hmacKey, signHmac } from "../functions/shared/signing";
import { readBuildData } from "../src/lib/config/build-data";
import { clients, testEnvironment } from "./test-environment";

export async function signTestLink(secrets: SecretSource, surveyId: string, baseUrl: string, uuid: string = randomUUID()) {
  const token = signHmac(hmacKey(await secrets("tracked-link-key")), { v: 1, s: surveyId, u: uuid });
  return { uuid, url: `${baseUrl.replace(/\/$/, "")}/invite#invite=${token}` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { values } = parseArgs({ options: { env: { type: "string" }, uuid: { type: "string" }, "base-url": { type: "string" } } });
  const environment = testEnvironment(values.env);
  const secrets = environment === "local" ? createFileSecretSource(".local/local.secrets.json") : createSecretsManagerSource(clients(environment).secrets, environment);
  // An empty --base-url prints a link relative to the site, for browser tests.
  const baseUrl = values["base-url"] ?? (environment === "local" ? "http://localhost:8787" : process.env.SURVEY_TEST_BASE_URL);
  if (baseUrl === undefined) throw new Error("Pass --base-url or set SURVEY_TEST_BASE_URL");

  signTestLink(secrets, readBuildData().surveyId, baseUrl, values.uuid).then(({ uuid, url }) => console.log(`Invite UUID ${uuid}\n${url}`));
}
