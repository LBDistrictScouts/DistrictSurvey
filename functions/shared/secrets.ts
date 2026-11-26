import { readFileSync } from "node:fs";
import { GetSecretValueCommand, type SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/**
 * A secret by name. Each secret is its own Secrets Manager secret at /district-survey/{environment}/{name},
 * so each identity is granted only what it needs. Each Lambda lists its own names in its handler, so
 * neither bundle names the other's secrets. scripts/create-secrets.ts lists them all.
 */
export type SecretSource = (name: string) => Promise<string>;

export const originHeaderSecret = "origin-header";

// Secrets change only between surveys or during a rotation, so a warm Lambda can keep them a while.
const cacheMilliseconds = 5 * 60 * 1000;

export function secretId(environment: string, name: string): string {
  return `/district-survey/${environment}/${name}`;
}

export function createSecretsManagerSource(client: SecretsManagerClient, environment: string, now: () => number = Date.now): SecretSource {
  const cache = new Map<string, { at: number; value: Promise<string> }>();

  return (name) => {
    const hit = cache.get(name);
    if (hit && now() - hit.at < cacheMilliseconds) return hit.value;

    const value = client.send(new GetSecretValueCommand({ SecretId: secretId(environment, name) })).then((result) => {
      if (!result.SecretString) throw new Error(`Secret ${name} is empty`);
      return result.SecretString;
    });
    // A failed read is not cached, so the next request tries again.
    value.catch(() => cache.delete(name));
    cache.set(name, { at: now(), value });
    return value;
  };
}

/** Reads secrets from the JSON file written by `yarn secrets:create --env local --generate`. */
export function createFileSecretSource(path: string): SecretSource {
  const values = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;

  return async (name) => {
    const value = values[name];
    if (!value) throw new Error(`Secret ${name} is missing from ${path}`);
    return value;
  };
}

/** The origin header secret is a JSON list, so a new value can be added before the old one is removed. */
export function parseOriginValues(secret: string): string[] {
  const values: unknown = JSON.parse(secret);
  if (!Array.isArray(values) || values.length === 0 || !values.every((value) => typeof value === "string" && value.length >= 32)) {
    throw new Error("The origin header secret must be a JSON list of values of at least 32 characters");
  }
  return values;
}
