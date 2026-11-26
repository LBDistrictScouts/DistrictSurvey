import { generateKeyPairSync, randomBytes, randomUUID, type KeyObject } from "node:crypto";
import type { CompiledSurvey } from "@lbdistrictscouts/survey-engine";
import { fixedControls, type Controls } from "../../functions/shared/controls";
import type { Event } from "../../functions/shared/http";
import type { LambdaMetric } from "../../functions/shared/metrics";
import { createMemoryRecordStore } from "../../functions/shared/s3-records";
import type { SecretSource } from "../../functions/shared/secrets";
import { signHmac } from "../../functions/shared/signing";
import type { SurveyWindow } from "../../functions/shared/survey-window";
import type { ResponseDeps, ResponseKeys } from "../../functions/response/save-response";
import type { TurnstileOutcome } from "../../functions/response/turnstile";
import type { CompletionMessage, TrackingDeps, TrackingKeys } from "../../functions/tracking/context";
import { exampleBuildData } from "../../src/lib/config/build-data";

export const buildData = exampleBuildData();
export const survey: CompiledSurvey = buildData.compiled;

export const window: SurveyWindow = { surveyId: survey.surveyId, opensAt: buildData.settings.opensAt, closesAt: buildData.settings.closesAt };

// A moment in the middle of the survey window.
export const during = new Date("2027-03-14T15:30:00Z");

export const originValue = "o".repeat(40);

function ed25519() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { privateKey, publicKey };
}

/** One set of keys shared by both Lambdas in a test, as one environment's secrets would be. */
export function createKeys() {
  const trackedPass = ed25519();
  const receipt = ed25519();
  const results = ed25519();
  const trackedLinkKey = randomBytes(32);

  const response: ResponseKeys = { fileNameKey: randomBytes(32), trackedPassPublicKey: trackedPass.publicKey, receiptPrivateKey: receipt.privateKey };
  const tracking: TrackingKeys = {
    trackedLinkKey,
    linkReferenceKey: randomBytes(32),
    receiptRecordKey: randomBytes(32),
    trackedPassPrivateKey: trackedPass.privateKey,
    receiptPublicKey: receipt.publicKey,
    resultsTokenPrivateKey: results.privateKey,
    resultsTokenPublicKey: results.publicKey,
  };

  return { response, tracking, trackedPass, receipt, results };
}

export type Keys = ReturnType<typeof createKeys>;

/** A tracked link token, signed the way DistrictWorkflow signs it. */
export function trackedLink(keys: Keys, uuid = randomUUID(), surveyId = survey.surveyId): string {
  return signHmac(keys.tracking.trackedLinkKey, { v: 1, s: surveyId, u: uuid });
}

export type Clock = { now: Date };

export function createWorld() {
  const keys = createKeys();
  const store = createMemoryRecordStore();
  const messages: CompletionMessage[] = [];
  const metrics: LambdaMetric[] = [];
  const clock: Clock = { now: during };
  let controls: Partial<Controls> = {};
  let turnstile: TurnstileOutcome = "accepted";
  let queueAvailable = true;

  const response: ResponseDeps = {
    survey,
    window,
    store,
    intakeBucket: "intake",
    usedRecordsBucket: "used",
    keys: async () => keys.response,
    controls: (...args) => fixedControls(controls)(...args),
    turnstile: async () => turnstile,
    metrics: async (name) => void metrics.push(name),
    now: () => clock.now,
  };

  const tracking: TrackingDeps = {
    window,
    store,
    usedRecordsBucket: "used",
    keys: async () => keys.tracking,
    controls: (...args) => fixedControls(controls)(...args),
    sendCompletion: async (message) => {
      if (!queueAvailable) throw new Error("queue unavailable");
      messages.push(message);
    },
    signCookies: async (surveyId, expiresAt) => [`CloudFront-Policy=${surveyId}; Expires=${expiresAt.toUTCString()}`],
    metrics: async (name) => void metrics.push(name),
    now: () => clock.now,
  };

  return {
    keys,
    store,
    messages,
    metrics,
    clock,
    response,
    tracking,
    setControls: (value: Partial<Controls>) => void (controls = value),
    setTurnstile: (value: TurnstileOutcome) => void (turnstile = value),
    setQueueAvailable: (value: boolean) => void (queueAvailable = value),
    objects: (prefix: string) => [...store.objects.keys()].filter((key) => key.startsWith(prefix)),
  };
}

export type World = ReturnType<typeof createWorld>;

/** An API Gateway HTTP API event, as CloudFront would forward it. */
export function apiEvent(routeKey: string, body: unknown, headers: Record<string, string> = { "x-origin-verify": originValue }): Event {
  return {
    version: "2.0",
    routeKey,
    rawPath: routeKey.split(" ")[1]!,
    rawQueryString: "",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: { requestId: "request-1", routeKey, http: { method: "POST", path: routeKey.split(" ")[1]!, protocol: "HTTP/1.1", sourceIp: "203.0.113.9", userAgent: "test" } },
  } as unknown as Event;
}

export const volunteerAnswers = { "age-group": "adult", "adult-roles": ["volunteer"], communication: 4, support: 3, time: "2-to-5" };

/** The test keys as the Secrets Manager values each Lambda reads. */
export function secretSource(keys: Keys): SecretSource {
  const privatePem = (key: KeyObject) => key.export({ type: "pkcs8", format: "pem" }).toString();
  const publicPem = (key: KeyObject) => key.export({ type: "spki", format: "pem" }).toString();
  const values: Record<string, string> = {
    "tracked-link-key": keys.tracking.trackedLinkKey.toString("base64"),
    "link-reference-key": keys.tracking.linkReferenceKey.toString("base64"),
    "file-name-key": keys.response.fileNameKey.toString("base64"),
    "receipt-record-key": keys.tracking.receiptRecordKey.toString("base64"),
    "tracked-pass-private-key": privatePem(keys.trackedPass.privateKey),
    "tracked-pass-public-key": publicPem(keys.trackedPass.publicKey),
    "receipt-private-key": privatePem(keys.receipt.privateKey),
    "receipt-public-key": publicPem(keys.receipt.publicKey),
    "results-token-private-key": privatePem(keys.results.privateKey),
    "results-token-public-key": publicPem(keys.results.publicKey),
    "cloudfront-cookie-private-key": "unused",
    "origin-header": JSON.stringify([originValue]),
    "turnstile-secret": "1x0000000000000000000000000000000AA",
  };
  return async (name) => {
    const value = values[name];
    if (value === undefined) throw new Error(`No test secret ${name}`);
    return value;
  };
}
