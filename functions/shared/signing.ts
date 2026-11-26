import { createHmac, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify, type KeyObject } from "node:crypto";
import { z } from "zod";

// Formats from contracts/schemas/tracked-link.v1.json and signed-values.v1.json.
// Each value is base64url(JSON payload) + "." + base64url(signature).

const surveyId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const unixTime = z.int().min(1_700_000_000).max(4_102_444_800);
const base64url43 = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const trackedLinkPayload = z.strictObject({ v: z.literal(1), s: surveyId, u: z.uuid() });
export const trackedPassPayload = z.strictObject({ v: z.literal(1), s: surveyId, l: base64url43, exp: unixTime });
export const receiptPayload = z.strictObject({ v: z.literal(1), s: surveyId, r: z.string().regex(/^[A-Za-z0-9_-]{22}$/), exp: unixTime });
export const resultsTokenPayload = z.strictObject({ v: z.literal(1), s: surveyId, a: z.literal("volunteer"), exp: unixTime });

export type TrackedLinkPayload = z.output<typeof trackedLinkPayload>;
export type TrackedPassPayload = z.output<typeof trackedPassPayload>;
export type ReceiptPayload = z.output<typeof receiptPayload>;
export type ResultsTokenPayload = z.output<typeof resultsTokenPayload>;

/** Why a signed value was refused. Never shown to the person or logged beyond "invalid". */
export class SignedValueError extends Error {
  constructor(reason: "format" | "signature" | "payload" | "survey" | "expired") {
    super(reason);
    this.name = "SignedValueError";
  }
}

const maxSignedValueLength = 600;

export function base64url(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

function split(value: string, signatureLength: number): { encoded: string; signature: Buffer } {
  if (value.length > maxSignedValueLength) throw new SignedValueError("format");
  const parts = value.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]!) || !/^[A-Za-z0-9_-]+$/.test(parts[1]!)) throw new SignedValueError("format");
  const signature = Buffer.from(parts[1]!, "base64url");
  if (signature.length !== signatureLength || base64url(signature) !== parts[1]) throw new SignedValueError("format");
  return { encoded: parts[0]!, signature };
}

function decode<T extends z.ZodType>(encoded: string, schema: T): z.output<T> {
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new SignedValueError("payload");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new SignedValueError("payload");
  return parsed.data;
}

export function hmac(key: Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

/** base64url(HMAC-SHA-256(key, value)): the 43-character one-way names used for files and records. */
export function hmacName(key: Buffer, value: string): string {
  return base64url(hmac(key, value));
}

export function linkRef(linkReferenceKey: Buffer, survey: string, uuid: string): string {
  return hmacName(linkReferenceKey, `${survey}:${uuid}`);
}

export function signHmac(key: Buffer, payload: object): string {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${base64url(hmac(key, encoded))}`;
}

export function signEd25519(privateKey: KeyObject, payload: object): string {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${base64url(sign(null, Buffer.from(encoded), privateKey))}`;
}

function checkSurveyAndExpiry(payload: { s: string; exp?: number }, expectedSurvey: string, nowSeconds: number): void {
  if (payload.s !== expectedSurvey) throw new SignedValueError("survey");
  if (payload.exp !== undefined && payload.exp <= nowSeconds) throw new SignedValueError("expired");
}

/** Checks a tracked link token signed by DistrictWorkflow with the tracked link key. */
export function verifyTrackedLink(key: Buffer, token: string, expectedSurvey: string): TrackedLinkPayload {
  const { encoded, signature } = split(token, 32);
  if (!timingSafeEqual(hmac(key, encoded), signature)) throw new SignedValueError("signature");
  const payload = decode(encoded, trackedLinkPayload);
  checkSurveyAndExpiry(payload, expectedSurvey, 0);
  return payload;
}

function verifyEd25519<T extends z.ZodType<{ s: string; exp: number }>>(publicKey: KeyObject, value: string, schema: T, expectedSurvey: string, nowSeconds: number): z.output<T> {
  const { encoded, signature } = split(value, 64);
  if (!verify(null, Buffer.from(encoded), publicKey, signature)) throw new SignedValueError("signature");
  const payload = decode(encoded, schema);
  checkSurveyAndExpiry(payload, expectedSurvey, nowSeconds);
  return payload;
}

export function verifyTrackedPass(publicKey: KeyObject, value: string, expectedSurvey: string, nowSeconds: number): TrackedPassPayload {
  return verifyEd25519(publicKey, value, trackedPassPayload, expectedSurvey, nowSeconds);
}

export function verifyReceipt(publicKey: KeyObject, value: string, expectedSurvey: string, nowSeconds: number): ReceiptPayload {
  return verifyEd25519(publicKey, value, receiptPayload, expectedSurvey, nowSeconds);
}

export function verifyResultsToken(publicKey: KeyObject, value: string, expectedSurvey: string, nowSeconds: number): ResultsTokenPayload {
  return verifyEd25519(publicKey, value, resultsTokenPayload, expectedSurvey, nowSeconds);
}

/** Reads an Ed25519 private key from PKCS#8 PEM, refusing any other key type. */
export function ed25519PrivateKey(pem: string): KeyObject {
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("Expected an Ed25519 private key");
  return key;
}

/** Reads an Ed25519 public key from SPKI PEM, refusing any other key type. */
export function ed25519PublicKey(pem: string): KeyObject {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("Expected an Ed25519 public key");
  return key;
}

/** Reads a 32-byte HMAC key stored as base64. */
export function hmacKey(base64: string): Buffer {
  const key = Buffer.from(base64.trim(), "base64");
  if (key.length < 32) throw new Error("HMAC keys must be at least 32 bytes");
  return key;
}
