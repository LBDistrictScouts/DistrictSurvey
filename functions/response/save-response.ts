import { createHash, randomBytes, randomUUID, type KeyObject } from "node:crypto";
import { evaluateSurvey, isQuestion, type Answers, type CompiledSurvey } from "@lbdistrictscouts/survey-engine";
import { z } from "zod";
import type { ControlSource } from "../shared/controls";
import { ApiError } from "../shared/http";
import type { MetricSink } from "../shared/metrics";
import type { RecordStore } from "../shared/s3-records";
import { base64url, hmacName, signEd25519, SignedValueError, verifyTrackedPass } from "../shared/signing";
import { londonDate, passExpiry, requireOpen, type SurveyWindow } from "../shared/survey-window";
import type { TurnstileVerifier } from "./turnstile";

const questionId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const answerValue = z.union([z.string().min(1).max(1000), z.array(questionId).min(1).max(50), z.int().min(-100).max(100)]);

const responseBase = {
  surveyId: z.string(),
  surveyVersion: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  submissionId: z.uuid(),
  answers: z.record(questionId, answerValue).refine((answers) => Object.keys(answers).length <= 200),
};

export const trackedRequest = z.strictObject({ ...responseBase, trackedPass: z.string().max(600), retrySecretHash: z.string().regex(/^[0-9a-f]{64}$/) });
export const openRequest = z.strictObject({ ...responseBase, turnstileToken: z.string().min(1).max(2048) });

export type TrackedRequest = z.output<typeof trackedRequest>;
export type OpenRequest = z.output<typeof openRequest>;

export type ResponseKeys = {
  fileNameKey: Buffer;
  trackedPassPublicKey: KeyObject;
  receiptPrivateKey: KeyObject;
};

export type ResponseDeps = {
  survey: CompiledSurvey;
  window: SurveyWindow;
  store: RecordStore;
  intakeBucket: string;
  usedRecordsBucket: string;
  keys: () => Promise<ResponseKeys>;
  controls: ControlSource;
  turnstile: TurnstileVerifier;
  metrics: MetricSink;
  now: () => Date;
};

/**
 * The fields stored for a response, exactly as listed in contracts/schemas/answer-file.v1.json.
 * tests/functions/stored-fields.test.ts fails if a field is added here without changing that list.
 */
export type AnswerFile = {
  schemaVersion: "1.0";
  surveyId: string;
  surveyVersion: string;
  submissionId: string;
  source: "open" | "tracked";
  submittedOn: string;
  answers: Answers;
};

export type CommentFile = {
  schemaVersion: "1.0";
  surveyId: string;
  surveyVersion: string;
  commentId: string;
  questionId: string;
  audience: "young-person" | "adult";
  source: "open" | "tracked";
  submittedOn: string;
  text: string;
};

export function answerKey(fileNameKey: Buffer, submissionId: string): string {
  return `intake/answers/${hmacName(fileNameKey, submissionId)}.json`;
}

export function commentKey(fileNameKey: Buffer, submissionId: string, question: string): string {
  return `intake/comments/${hmacName(fileNameKey, `${submissionId}:${question}`)}.json`;
}

export function usedLinkKey(linkRef: string): string {
  return `links/${linkRef}`;
}

type Prepared = { answerFile: AnswerFile; comments: CommentFile[]; youngPerson: boolean };

/**
 * Checks the answers against the path calculated from them, then splits comment answers out into
 * their own files so a comment cannot be joined to the rest of its response.
 */
function prepare(deps: ResponseDeps, request: TrackedRequest | OpenRequest, source: "open" | "tracked"): Prepared {
  const { survey } = deps;
  if (request.surveyId !== survey.surveyId) throw new ApiError("invalid_answers");
  if (request.surveyVersion !== survey.fingerprint) throw new ApiError("version_changed");

  const evaluation = evaluateSurvey(survey, request.answers, [`source:${source}`]);
  const rejected = [...new Set([...evaluation.errors.map((error) => error.questionId), ...evaluation.staleAnswers])];
  if (rejected.length > 0) throw new ApiError("invalid_answers", rejected.sort());

  const commentIds = new Set(survey.blocks.flatMap((block) => block.items).filter((item) => isQuestion(item) && item.type === "text" && item.comment).map((item) => item.id));
  const submittedOn = londonDate(deps.now());
  const youngPerson = evaluation.tags.includes("young-person");
  const answers: Answers = {};
  const comments: CommentFile[] = [];

  for (const [id, value] of Object.entries(request.answers)) {
    if (!commentIds.has(id)) {
      answers[id] = value;
      continue;
    }
    comments.push({
      schemaVersion: "1.0",
      surveyId: survey.surveyId,
      surveyVersion: survey.fingerprint,
      commentId: randomUUID(),
      questionId: id,
      audience: youngPerson ? "young-person" : "adult",
      source,
      submittedOn,
      text: String(value),
    });
  }

  const answerFile: AnswerFile = { schemaVersion: "1.0", surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: request.submissionId, source, submittedOn, answers };
  return { answerFile, comments, youngPerson };
}

async function writeComments(deps: ResponseDeps, keys: ResponseKeys, submissionId: string, comments: CommentFile[]): Promise<void> {
  // Names come from the submission ID, so a retry finds the files the first attempt wrote.
  for (const comment of comments) {
    await deps.store.putIfAbsent(deps.intakeBucket, commentKey(keys.fileNameKey, submissionId, comment.questionId), JSON.stringify(comment));
  }
}

/**
 * Saves a tracked response in three steps: save the answers, claim the link, save the comments.
 * Claiming after saving means a failed claim never leaves a used link without its answers.
 */
export async function saveTrackedResponse(deps: ResponseDeps, request: TrackedRequest): Promise<{ status: "saved" }> {
  const now = deps.now();
  requireOpen(deps.window, await deps.controls(), "tracked", now);

  const keys = await deps.keys();
  let pass;
  try {
    pass = verifyTrackedPass(keys.trackedPassPublicKey, request.trackedPass, deps.survey.surveyId, Math.floor(now.getTime() / 1000));
  } catch (error) {
    if (error instanceof SignedValueError) throw new ApiError("invalid_link");
    throw error;
  }

  const { answerFile, comments } = prepare(deps, request, "tracked");
  const fileKey = answerKey(keys.fileNameKey, request.submissionId);
  const saved = await deps.store.putIfAbsent(deps.intakeBucket, fileKey, JSON.stringify(answerFile));

  const claim = await deps.store.putIfAbsent(deps.usedRecordsBucket, usedLinkKey(pass.l), request.retrySecretHash);
  if (claim === "exists") {
    const existing = await deps.store.get(deps.usedRecordsBucket, usedLinkKey(pass.l));
    if (existing !== request.retrySecretHash) {
      // The link was used by a different submission. Remove only the answer file this request created.
      if (saved === "created") await deps.store.delete(deps.intakeBucket, fileKey);
      throw new ApiError("already_completed");
    }
  }

  await writeComments(deps, keys, request.submissionId, comments);
  return { status: "saved" };
}

/** Saves an open-link response after a Turnstile check, and gives adults a receipt. */
export async function saveOpenResponse(deps: ResponseDeps, request: OpenRequest): Promise<{ status: "saved"; receipt?: string; receiptExpiresAt?: string }> {
  const now = deps.now();
  requireOpen(deps.window, await deps.controls(), "open", now);

  const prepared = prepare(deps, request, "open");

  const outcome = await deps.turnstile(request.turnstileToken, request.submissionId);
  if (outcome === "unavailable") throw new ApiError("temporarily_unavailable");
  if (outcome === "rejected") {
    await deps.metrics("TurnstileRejected");
    throw new ApiError("verification_failed");
  }

  const keys = await deps.keys();
  await deps.store.putIfAbsent(deps.intakeBucket, answerKey(keys.fileNameKey, request.submissionId), JSON.stringify(prepared.answerFile));
  await writeComments(deps, keys, request.submissionId, prepared.comments);

  // Young people receive no receipt: they cannot hold a tracked link.
  if (prepared.youngPerson) return { status: "saved" };

  const exp = passExpiry(deps.window);
  const receipt = signEd25519(keys.receiptPrivateKey, { v: 1, s: deps.survey.surveyId, r: base64url(randomBytes(16)), exp });
  return { status: "saved", receipt, receiptExpiresAt: new Date(exp * 1000).toISOString() };
}

/** SHA-256 of the browser's retry secret, as the browser sends it. Exported for tests and test scripts. */
export function retrySecretHash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
