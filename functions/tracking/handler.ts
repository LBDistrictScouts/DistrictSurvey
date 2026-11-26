import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { SSMClient } from "@aws-sdk/client-ssm";
import { createSsmControls } from "../shared/controls";
import { requiredEnv, type BundledSettings } from "../shared/environment";
import { createHandler, json, readBody, type Event, type Route } from "../shared/http";
import { createCloudWatchMetrics } from "../shared/metrics";
import { createS3RecordStore } from "../shared/s3-records";
import { createSecretsManagerSource, originHeaderSecret, parseOriginValues, type SecretSource } from "../shared/secrets";
import { ed25519PrivateKey, ed25519PublicKey, hmacKey } from "../shared/signing";
import { claimReceipt, claimRequest } from "./claim-receipt";
import { completeLink } from "./complete-link";
import { tokenRequest, type CompletionMessage, type TrackingDeps, type TrackingKeys } from "./context";
import { createCookieSigner } from "./cookies";
import { declineLink } from "./decline-link";
import { openTrackedLink } from "./open-tracked-link";
import { resultsAccess } from "./results-access";
import { startLink } from "./start-link";

/** The only secrets the tracking Lambda can read. */
export const trackingSecretNames = {
  trackedLinkKey: "tracked-link-key",
  linkReferenceKey: "link-reference-key",
  receiptRecordKey: "receipt-record-key",
  trackedPassPrivateKey: "tracked-pass-private-key",
  receiptPublicKey: "receipt-public-key",
  resultsTokenPrivateKey: "results-token-private-key",
  resultsTokenPublicKey: "results-token-public-key",
  cloudfrontCookiePrivateKey: "cloudfront-cookie-private-key",
  originHeader: originHeaderSecret,
} as const;

export const trackingRoutes = {
  open: "POST /api/v1/tracking/open",
  start: "POST /api/v1/tracking/start",
  complete: "POST /api/v1/tracking/complete",
  claim: "POST /api/v1/tracking/claim",
  decline: "POST /api/v1/tracking/decline",
  resultsAccess: "POST /api/results-access",
} as const;

export function createTrackingRoutes(deps: TrackingDeps): Record<string, Route> {
  const token = (event: Event) => readBody(event, tokenRequest, "invalid_link").token;

  return {
    [trackingRoutes.open]: async (event) => ({ result: json(200, await openTrackedLink(deps, token(event))), source: "tracked" }),
    [trackingRoutes.start]: async (event) => ({ result: json(200, await startLink(deps, token(event))), source: "tracked" }),
    [trackingRoutes.complete]: async (event) => ({ result: json(200, await completeLink(deps, token(event))), source: "tracked" }),
    [trackingRoutes.claim]: async (event) => {
      const request = readBody(event, claimRequest, "invalid_link");
      return { result: json(200, await claimReceipt(deps, request.token, request.receipt)), source: "tracked" };
    },
    [trackingRoutes.decline]: async (event) => ({ result: json(200, await declineLink(deps, token(event))), source: "tracked" }),
    [trackingRoutes.resultsAccess]: async (event) => {
      const { body, cookies } = await resultsAccess(deps, token(event));
      return { result: json(200, body, cookies) };
    },
  };
}

export function trackingKeys(secrets: SecretSource): () => Promise<TrackingKeys> {
  return async () => ({
    trackedLinkKey: hmacKey(await secrets(trackingSecretNames.trackedLinkKey)),
    linkReferenceKey: hmacKey(await secrets(trackingSecretNames.linkReferenceKey)),
    receiptRecordKey: hmacKey(await secrets(trackingSecretNames.receiptRecordKey)),
    trackedPassPrivateKey: ed25519PrivateKey(await secrets(trackingSecretNames.trackedPassPrivateKey)),
    receiptPublicKey: ed25519PublicKey(await secrets(trackingSecretNames.receiptPublicKey)),
    resultsTokenPrivateKey: ed25519PrivateKey(await secrets(trackingSecretNames.resultsTokenPrivateKey)),
    resultsTokenPublicKey: ed25519PublicKey(await secrets(trackingSecretNames.resultsTokenPublicKey)),
  });
}

export function sqsSender(client: SQSClient, queueUrl: string): (message: CompletionMessage) => Promise<void> {
  return async (message) => {
    await client.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message) }));
  };
}

/** Builds the tracking Lambda from its dependencies and the values bundled at build time. */
export function createTrackingLambda(settings: BundledSettings, secrets: SecretSource, deps: Omit<TrackingDeps, "window" | "keys">) {
  const routes = createTrackingRoutes({ ...deps, window: settings, keys: trackingKeys(secrets) });
  return createHandler(routes, settings.buildId, async () => parseOriginValues(await secrets(trackingSecretNames.originHeader)));
}

declare const __SURVEY_SETTINGS__: BundledSettings;

let lambda: ReturnType<typeof createTrackingLambda> | undefined;

/** The deployed entry point. Clients are created once per Lambda instance. */
export async function handler(event: Event) {
  if (!lambda) {
    const environment = requiredEnv("SURVEY_ENVIRONMENT");
    const secrets = createSecretsManagerSource(new SecretsManagerClient({}), environment);
    lambda = createTrackingLambda(__SURVEY_SETTINGS__, secrets, {
      store: createS3RecordStore(new S3Client({})),
      usedRecordsBucket: requiredEnv("USED_RECORDS_BUCKET"),
      controls: createSsmControls(new SSMClient({}), environment),
      sendCompletion: sqsSender(new SQSClient({}), requiredEnv("COMPLETION_QUEUE_URL")),
      signCookies: createCookieSigner(requiredEnv("RESULTS_DOMAIN"), requiredEnv("CLOUDFRONT_KEY_PAIR_ID"), () => secrets(trackingSecretNames.cloudfrontCookiePrivateKey)),
      metrics: createCloudWatchMetrics(new CloudWatchClient({}), environment),
      now: () => new Date(),
    });
  }
  return lambda(event);
}
