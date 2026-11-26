"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateSurvey, isQuestion, withoutStaleAnswers, type Answers, type AnswerValue, type CompiledSurvey } from "@lbdistrictscouts/survey-engine";
import type { ApiResult } from "@/lib/client/api";
import { saveDraft, type Draft } from "@/lib/client/drafts";
import type { SiteSettings } from "@/lib/config/site";
import type { ErrorCode } from "@/lib/contracts/types";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { BlockProgress } from "./BlockProgress";
import { HelpPanel } from "./HelpPanel";
import { PathChangeWarning } from "./PathChangeWarning";
import { errorMessages, QuestionField } from "./QuestionField";
import { SubmissionMessage } from "./SubmissionMessage";

export type SurveyRunnerProps<T> = {
  survey: CompiledSurvey;
  settings: SiteSettings;
  draft: Draft;
  /** Sends the response. Called with the answers that belong on the person's path. */
  submit: (draft: Draft) => Promise<ApiResult<T>>;
  onSubmitted: (result: T, draft: Draft) => void;
  /** Starts again with no answers and a new submission ID. */
  onClear: () => Draft;
  /** Shown above the first section, such as the opt-out on a tracked link. */
  intro?: React.ReactNode;
};

type Pending = { next: Answers; stale: string[] };

/**
 * Asks one section at a time. Each answer is saved in this browser straight away and never sent until
 * the person submits. Answers on paths that no longer apply are removed only after a warning.
 */
export function SurveyRunner<T>({ survey, settings, draft: initialDraft, submit, onSubmitted, onClear, intro }: SurveyRunnerProps<T>) {
  const systemTags = useMemo(() => [`source:${initialDraft.mode}`], [initialDraft.mode]);
  const [draft, setDraft] = useState(initialDraft);
  const [blockIndex, setBlockIndex] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending>();
  const [clearing, setClearing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<ErrorCode>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const evaluation = useMemo(() => evaluateSurvey(survey, draft.answers, systemTags), [survey, draft.answers, systemTags]);
  const blocks = useMemo(() => survey.blocks.filter((block) => evaluation.visible.some((entry) => entry.blockId === block.id)), [survey.blocks, evaluation.visible]);
  const index = Math.min(blockIndex, blocks.length - 1);
  const block = blocks[index]!;
  const items = evaluation.visible.filter((entry) => entry.blockId === block.id);
  const last = index === blocks.length - 1;

  const errorsFor = (ids: Set<string>) => {
    const found = new Map<string, string>();
    for (const error of evaluation.errors) if (ids.has(error.questionId)) found.set(error.questionId, errorMessages[error.code] ?? errorMessages.rejected!);
    for (const id of rejected) if (ids.has(id) && !found.has(id)) found.set(id, errorMessages.rejected!);
    return found;
  };

  const blockQuestionIds = new Set(items.filter((entry) => isQuestion(entry.item)).map((entry) => entry.item.id));
  const blockErrors = showErrors ? errorsFor(blockQuestionIds) : new Map<string, string>();

  // Move focus to the section heading whenever the section changes, so screen readers start there.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  const commit = (answers: Answers) => {
    const youngPerson = evaluateSurvey(survey, answers, systemTags).tags.includes("young-person");
    setDraft((current) => saveDraft({ ...current, answers }, youngPerson));
    setRejected((current) => current.filter((id) => answers[id] === draft.answers[id]));
    setFailure(undefined);
  };

  const change = (id: string, value: AnswerValue | undefined) => {
    const next = { ...draft.answers };
    if (value === undefined) delete next[id];
    else next[id] = value;
    const stale = evaluateSurvey(survey, next, systemTags).staleAnswers;
    if (stale.length > 0) setPending({ next, stale });
    else commit(next);
  };

  const firstBlockWithError = (ids: string[]) => blocks.findIndex((candidate) => candidate.items.some((item) => ids.includes(item.id)));

  const goNext = () => {
    if (blockErrors.size > 0 || errorsFor(blockQuestionIds).size > 0) {
      setShowErrors(true);
      headingRef.current?.focus();
      return;
    }
    setShowErrors(false);
    setBlockIndex(index + 1);
  };

  const send = async () => {
    const allErrors = evaluation.errors.map((error) => error.questionId);
    if (allErrors.length > 0) {
      setShowErrors(true);
      setBlockIndex(Math.max(0, firstBlockWithError(allErrors)));
      headingRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setFailure(undefined);
    const result = await submit(draft);
    setSubmitting(false);

    if (result.ok) {
      onSubmitted(result.data, draft);
      return;
    }

    setFailure(result.code);
    if (result.code === "invalid_answers" && result.questionIds?.length) {
      setRejected(result.questionIds);
      setShowErrors(true);
      setBlockIndex(Math.max(0, firstBlockWithError(result.questionIds)));
    }
  };

  const clear = () => {
    setDraft(onClear());
    setBlockIndex(0);
    setShowErrors(false);
    setRejected([]);
    setFailure(undefined);
    setClearing(false);
  };

  return (
    <div className="grid gap-6">
      {intro}
      <BlockProgress current={index + 1} total={blocks.length} />

      <form
        className="grid gap-6 rounded-card bg-bg-white-0 p-5 ring-1 ring-stroke-soft-200 sm:p-8"
        aria-labelledby="block-heading"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (last) void send();
          else goNext();
        }}
      >
        <h2 id="block-heading" ref={headingRef} tabIndex={-1} className="text-title-h5 outline-none">
          {block.title ?? `Section ${index + 1}`}
        </h2>

        {blockErrors.size > 0 ? (
          <Alert status="error" title={blockErrors.size === 1 ? "There is a problem with 1 answer" : `There are problems with ${blockErrors.size} answers`}>
            <ul className="list-disc pl-5">
              {[...blockErrors.keys()].map((id) => (
                <li key={id}>
                  <a href={`#${id}-question`}>{survey.blocks.flatMap((candidate) => candidate.items).find((item) => item.id === id)?.text}</a>
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {items.map(({ item, options }) =>
          isQuestion(item) ? (
            <QuestionField key={item.id} question={item} options={options} value={draft.answers[item.id]} onChange={(value) => change(item.id, value)} error={blockErrors.get(item.id)} />
          ) : item.kind === "help" ? (
            <HelpPanel key={item.id} text={item.text} helpContact={settings.helpContact} />
          ) : (
            <p key={item.id} className="text-paragraph-md text-text-sub-600">
              {item.text}
            </p>
          ),
        )}

        {failure ? <SubmissionMessage code={failure} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          {index > 0 ? (
            <Button variant="secondary" onClick={() => setBlockIndex(index - 1)} disabled={submitting}>
              Back
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting} aria-describedby={last ? "submit-note" : undefined}>
            {last ? (submitting ? "Sending your answers…" : "Send my answers") : "Continue"}
          </Button>
        </div>
        {last ? (
          <p id="submit-note" className="text-paragraph-sm text-text-sub-600">
            Your answers stay on this device until we confirm they have been received.
          </p>
        ) : null}
      </form>

      <div>
        <Button variant="quiet" onClick={() => setClearing(true)} disabled={submitting}>
          Clear my answers
        </Button>
      </div>

      <PathChangeWarning
        open={pending !== undefined}
        count={pending?.stale.length ?? 0}
        onCancel={() => setPending(undefined)}
        onConfirm={() => {
          if (pending) commit(withoutStaleAnswers(survey, pending.next, systemTags));
          setPending(undefined);
        }}
      />

      <Modal
        open={clearing}
        onOpenChange={setClearing}
        title="Clear your answers?"
        description="This removes every answer saved on this device. You can then start again."
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearing(false)}>
              Keep my answers
            </Button>
            <Button onClick={clear}>Clear answers</Button>
          </>
        }
      />
    </div>
  );
}
