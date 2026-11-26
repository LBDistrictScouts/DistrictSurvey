import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SSMClient } from "@aws-sdk/client-ssm";
import type { CompiledSurvey } from "@lbdistrictscouts/survey-engine";
import { createSsmControls } from "../shared/controls";
import { requiredEnv, type BundledSettings } from "../shared/environment";
import { createHandler, json, readBody, type Event, type Route } from "../shared/http";
import { createCloudWatchMetrics } from "../shared/metrics";
import { createS3RecordStore } from "../shared/s3-records";
import { createSecretsManagerSource, originHeaderSecret, parseOriginValues, type SecretSource } from "../shared/secrets";
import { ed25519PrivateKey, ed25519PublicKey, hmacKey } from "../shared/signing";
import { openRequest, saveOpenResponse, saveTrackedResponse, trackedRequest, type ResponseDeps, type ResponseKeys } from "./save-response";
import { createTurnstileVerifier } from "./turnstile";

/** The only secrets the response Lambda can read. */
export const responseSecretNames = {
  fileNameKey: "file-name-key",
  trackedPassPublicKey: "tracked-pass-public-key",
  receiptPrivateKey: "receipt-private-key",
  turnstileSecret: "turnstile-secret",
  originHeader: originHeaderSecret,
} as const;

export const responseRoutes = {
  tracked: "POST /api/v1/responses/tracked",
  open: "POST /api/v1/responses/open",
} as const;

export function createResponseRoutes(deps: ResponseDeps): Record<string, Route> {
  return {
    [responseRoutes.tracked]: async (event: Event) => {
      const request = readBody(event, trackedRequest, "invalid_answers");
      return { result: json(200, await saveTrackedResponse(deps, request)), source: "tracked", surveyVersion: deps.survey.fingerprint };
    },
    [responseRoutes.open]: async (event: Event) => {
      const request = readBody(event, openRequest, "invalid_answers");
      return { result: json(200, await saveOpenResponse(deps, request)), source: "open", surveyVersion: deps.survey.fingerprint };
    },
  };
}

export function responseKeys(secrets: SecretSource): () => Promise<ResponseKeys> {
  return async () => ({
    fileNameKey: hmacKey(await secrets(responseSecretNames.fileNameKey)),
    trackedPassPublicKey: ed25519PublicKey(await secrets(responseSecretNames.trackedPassPublicKey)),
    receiptPrivateKey: ed25519PrivateKey(await secrets(responseSecretNames.receiptPrivateKey)),
  });
}

/** Builds the response Lambda from AWS clients and the values bundled at build time. */
export function createResponseLambda(survey: CompiledSurvey, settings: BundledSettings, secrets: SecretSource, deps: Omit<ResponseDeps, "survey" | "window" | "keys" | "turnstile">, turnstileHostname?: string, turnstileUrl?: string) {
  const turnstile = createTurnstileVerifier(() => secrets(responseSecretNames.turnstileSecret), turnstileHostname, fetch, turnstileUrl);
  const routes = createResponseRoutes({ ...deps, survey, window: settings, keys: responseKeys(secrets), turnstile });
  return createHandler(routes, settings.buildId, async () => parseOriginValues(await secrets(responseSecretNames.originHeader)));
}

declare const __SURVEY_SETTINGS__: BundledSettings;
declare const __COMPILED_SURVEY__: CompiledSurvey;

let lambda: ReturnType<typeof createResponseLambda> | undefined;

/** The deployed entry point. Clients are created once per Lambda instance. */
export async function handler(event: Event) {
  if (!lambda) {
    const environment = requiredEnv("SURVEY_ENVIRONMENT");
    const secrets = createSecretsManagerSource(new SecretsManagerClient({}), environment);
    lambda = createResponseLambda(__COMPILED_SURVEY__, __SURVEY_SETTINGS__, secrets, {
      store: createS3RecordStore(new S3Client({})),
      intakeBucket: requiredEnv("INTAKE_BUCKET"),
      usedRecordsBucket: requiredEnv("USED_RECORDS_BUCKET"),
      controls: createSsmControls(new SSMClient({}), environment),
      metrics: createCloudWatchMetrics(new CloudWatchClient({}), environment),
      now: () => new Date(),
    }, process.env.TURNSTILE_HOSTNAME || undefined);
  }
  return lambda(event);
}
