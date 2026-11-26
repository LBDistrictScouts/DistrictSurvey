// yarn secrets:create --env <local|test|prod> --generate
// yarn secrets:create --env <local|test|prod> --store
//
// Step 1 (--generate) creates every key and token in .local/, and writes the public keys to a file for
// terraform apply. Step 3 (--store) writes each value into its Secrets Manager container and into
// 1Password, then deletes the local copies. The local environment keeps its file, which the local
// Lambda server reads.
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { CreateSecretCommand, PutSecretValueCommand, ResourceNotFoundException, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { secretId } from "../functions/shared/secrets";

export const environments = ["local", "test", "prod"] as const;
export type Environment = (typeof environments)[number];

/** Secrets read by the Lambdas or DistrictWorkflow, held in Secrets Manager. */
export const awsSecrets = [
  "tracked-link-key",
  "link-reference-key",
  "file-name-key",
  "receipt-record-key",
  "tracked-pass-private-key",
  "tracked-pass-public-key",
  "receipt-private-key",
  "receipt-public-key",
  "results-token-private-key",
  "results-token-public-key",
  "cloudfront-cookie-private-key",
] as const;

/** DistrictStatistics service tokens, held in 1Password for the hosting plan to deliver. */
export const serviceTokens = ["statistics-import-token", "statistics-comments-token", "statistics-survey-admin-token", "statistics-build-token", "statistics-results-viewer-token"] as const;

// Terraform creates these outside the local environment: Cloudflare issues the Turnstile key, and
// the origin header values are generated in state so CloudFront and the secret always match.
const localOnly = ["origin-header", "turnstile-secret"] as const;

export type GeneratedSecrets = Record<string, string>;

function ed25519Pair(): [string, string] {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return [privateKey.export({ type: "pkcs8", format: "pem" }).toString(), publicKey.export({ type: "spki", format: "pem" }).toString()];
}

export function generateSecrets(environment: Environment): { secrets: GeneratedSecrets; publicKeys: Record<string, string> } {
  const hmac = () => randomBytes(32).toString("base64");
  const [passPrivate, passPublic] = ed25519Pair();
  const [receiptPrivate, receiptPublic] = ed25519Pair();
  const [resultsPrivate, resultsPublic] = ed25519Pair();
  const cookie = generateKeyPairSync("rsa", { modulusLength: 2048 });

  const secrets: GeneratedSecrets = {
    "tracked-link-key": hmac(),
    "link-reference-key": hmac(),
    "file-name-key": hmac(),
    "receipt-record-key": hmac(),
    "tracked-pass-private-key": passPrivate,
    "tracked-pass-public-key": passPublic,
    "receipt-private-key": receiptPrivate,
    "receipt-public-key": receiptPublic,
    "results-token-private-key": resultsPrivate,
    "results-token-public-key": resultsPublic,
    "cloudfront-cookie-private-key": cookie.privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
  };
  for (const name of serviceTokens) secrets[name] = randomBytes(32).toString("base64url");

  if (environment === "local") {
    secrets["origin-header"] = JSON.stringify([randomBytes(32).toString("base64url")]);
    // Cloudflare's published test secret that always passes.
    secrets["turnstile-secret"] = "1x0000000000000000000000000000000AA";
  }

  const publicKeys = {
    cloudfront_public_key_pem: cookie.publicKey.export({ type: "spki", format: "pem" }).toString(),
    results_token_public_key_pem: resultsPublic,
  };
  return { secrets, publicKeys };
}

export function localPaths(environment: Environment, directory = ".local") {
  return { secrets: join(directory, `${environment}.secrets.json`), publicKeys: join(directory, `${environment}.public-keys.json`) };
}

function writePrivate(path: string, value: object): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

async function putSecret(client: SecretsManagerClient, name: string, value: string): Promise<void> {
  try {
    await client.send(new PutSecretValueCommand({ SecretId: name, SecretString: value }));
  } catch (error) {
    // Terraform creates empty containers in AWS. The local environment has none, so create them.
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(new CreateSecretCommand({ Name: name, SecretString: value }));
  }
}

function storeIn1Password(environment: Environment, secrets: GeneratedSecrets, vault: string): void {
  const fields = Object.entries(secrets).map(([name, value]) => `${name}[password]=${value}`);
  execFileSync("op", ["item", "create", "--category", "Secure Note", "--vault", vault, "--title", `District survey ${environment} secrets ${new Date().toISOString().slice(0, 10)}`, ...fields], { stdio: ["ignore", "ignore", "inherit"] });
}

export async function main(argv: string[], client = new SecretsManagerClient({})): Promise<string> {
  const { values } = parseArgs({ args: argv, options: { env: { type: "string" }, generate: { type: "boolean" }, store: { type: "boolean" }, vault: { type: "string", default: "District Survey" } } });
  const environment = values.env as Environment;
  if (!environments.includes(environment)) throw new Error(`--env must be one of ${environments.join(", ")}`);
  if (values.generate === values.store) throw new Error("Use exactly one of --generate or --store");

  const paths = localPaths(environment);

  if (values.generate) {
    if (existsSync(paths.secrets)) throw new Error(`${paths.secrets} exists. Store or delete it before generating again.`);
    mkdirSync(".local", { recursive: true });
    const { secrets, publicKeys } = generateSecrets(environment);
    writePrivate(paths.secrets, secrets);
    writeFileSync(paths.publicKeys, `${JSON.stringify(publicKeys, null, 2)}\n`);
    return `Generated ${Object.keys(secrets).length} secrets in ${paths.secrets}.\nPass cloudfront_public_key_pem from ${paths.publicKeys} to terraform apply, then run --store.`;
  }

  const secrets: GeneratedSecrets = JSON.parse(readFileSync(paths.secrets, "utf8"));
  const names = environment === "local" ? [...awsSecrets, ...localOnly] : awsSecrets;
  for (const name of names) await putSecret(client, secretId(environment, name), secrets[name]!);

  if (environment === "local") return `Stored ${names.length} secrets in the local Secrets Manager. ${paths.secrets} is kept for the local Lambda server.`;

  storeIn1Password(environment, secrets, values.vault!);
  rmSync(paths.secrets);
  rmSync(paths.publicKeys, { force: true });
  return `Stored ${names.length} secrets in Secrets Manager and every value in 1Password, then deleted the local copies.`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).then(console.log, (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
