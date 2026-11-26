"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultAnswers, type CompiledSurvey } from "@lbdistrictscouts/survey-engine";
import { resultsAccessUrl, surveyApi } from "@/lib/client/api";
import { clearDraft, hashRetrySecret, loadDraft, newDraft, saveDraft, type Draft } from "@/lib/client/drafts";
import { markDeclined, readInviteToken, wasDeclined } from "@/lib/client/invite-link";
import { clearReceipt, loadReceipt } from "@/lib/client/receipts";
import type { SiteSettings } from "@/lib/config/site";
import type { ErrorCode } from "@/lib/contracts/types";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { OptOut } from "./OptOut";
import { ReceiptPrompt } from "./ReceiptPrompt";
import { ReopenLinkMessage } from "./ReopenLinkMessage";
import { SubmissionMessage } from "./SubmissionMessage";
import { SurveyRunner } from "./SurveyRunner";

type Phase =
  | { name: "loading" }
  | { name: "no-link"; hasDraft: boolean }
  | { name: "failed"; code: ErrorCode }
  | { name: "receipt"; pass: string; closesAt: string; receipt: string }
  | { name: "start"; pass: string; closesAt: string }
  | { name: "answering"; draft: Draft }
  | { name: "completing" }
  | { name: "completed"; resultsToken: string }
  | { name: "declined" };

export type InviteSurveyProps = { survey: CompiledSurvey; settings: SiteSettings };

const graceMilliseconds = 60 * 60 * 1000;

/** The tracked-link survey for an invited volunteer. It loads no third-party scripts. */
export function InviteSurvey({ survey, settings }: InviteSurveyProps) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [token, setToken] = useState<string>();
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ErrorCode>();
  const systemTags = ["source:tracked"];

  useEffect(() => {
    const found = readInviteToken();
    // The link is read from the address once the page has loaded, so the phase is set here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(found);
    if (!found) {
      setPhase({ name: "no-link", hasDraft: Boolean(loadDraft(survey.surveyId, survey.fingerprint, "tracked").draft) });
      return;
    }

    void wasDeclined(found).then(setDeclined);
    void surveyApi.openTrackedLink(found).then((result) => {
      if (!result.ok) return setPhase({ name: "failed", code: result.code });
      if (result.data.status === "completed") return setPhase({ name: "completed", resultsToken: result.data.resultsToken });
      const receipt = loadReceipt(survey.surveyId);
      if (receipt) return setPhase({ name: "receipt", pass: result.data.trackedPass, closesAt: result.data.closesAt, receipt: receipt.receipt });
      setPhase({ name: "start", pass: result.data.trackedPass, closesAt: result.data.closesAt });
    });
  }, [survey.surveyId, survey.fingerprint]);

  // A second invitation link opened in the same tab only changes the address fragment, so reload to read it.
  useEffect(() => {
    const reload = () => {
      if (window.location.hash.includes("invite=")) window.location.reload();
    };
    window.addEventListener("hashchange", reload);
    return () => window.removeEventListener("hashchange", reload);
  }, []);

  const start = useCallback((pass: string, closesAt: string) => {
    if (!token) return;
    // Pressing Start moves the task to in_progress. A failure here does not stop the person answering.
    void surveyApi.startTrackedLink(token);
    const passExpiresAt = new Date(Date.parse(closesAt) + graceMilliseconds).toISOString();
    const saved = loadDraft(survey.surveyId, survey.fingerprint, "tracked").draft;
    const draft = saved ?? { ...newDraft(survey.surveyId, survey.fingerprint, "tracked"), answers: defaultAnswers(survey, {}, systemTags) };
    setPhase({ name: "answering", draft: saveDraft({ ...draft, trackedPass: pass, passExpiresAt }, false) });
    // systemTags is constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, survey]);

  const claim = async (receipt: string) => {
    if (!token) return;
    setBusy(true);
    const result = await surveyApi.claimReceipt(token, receipt);
    setBusy(false);
    if (!result.ok) return setNotice(result.code);
    clearReceipt(survey.surveyId);
    setPhase({ name: "completed", resultsToken: result.data.resultsToken });
  };

  const decline = async () => {
    if (!token) return false;
    const result = await surveyApi.declineTrackedLink(token);
    if (!result.ok) {
      setNotice(result.code);
      return false;
    }
    await markDeclined(token);
    setDeclined(true);
    setPhase({ name: "declined" });
    return true;
  };

  const complete = async () => {
    if (!token) return;
    setPhase({ name: "completing" });
    clearDraft(survey.surveyId, "tracked");
    const result = await surveyApi.completeTrackedLink(token);
    // The answers are saved even if this fails. Reopening the email link completes the task.
    if (!result.ok) return setPhase({ name: "failed", code: result.code });
    setPhase({ name: "completed", resultsToken: result.data.resultsToken });
  };

  return (
    <div className="grid gap-6">
      {notice ? <SubmissionMessage code={notice} /> : null}

      {phase.name === "loading" ? <p role="status">Checking your invitation…</p> : null}
      {phase.name === "no-link" ? <ReopenLinkMessage hasDraft={phase.hasDraft} /> : null}
      {phase.name === "failed" ? <SubmissionMessage code={phase.code} /> : null}

      {phase.name === "receipt" ? (
        <ReceiptPrompt busy={busy} onAlreadyResponded={() => void claim(phase.receipt)} onNotResponded={() => setPhase({ name: "start", pass: phase.pass, closesAt: phase.closesAt })} />
      ) : null}

      {phase.name === "start" ? (
        <section aria-labelledby="start-heading" className="grid gap-4 rounded-card bg-bg-white-0 p-6 ring-1 ring-stroke-soft-200">
          <h2 id="start-heading" className="text-title-h5">
            Your invitation
          </h2>
          {declined ? (
            <Alert status="information" title="You asked us to stop reminders for this survey" live={false}>
              <p>You won&apos;t get any more reminders. You can still take part if you&apos;d like to.</p>
            </Alert>
          ) : null}
          <p className="text-paragraph-md">The survey takes about 10 minutes. Your answers are saved on this device as you go.</p>
          <div>
            <Button onClick={() => start(phase.pass, phase.closesAt)}>Start the survey</Button>
          </div>
          {declined ? null : <OptOut onDecline={decline} />}
        </section>
      ) : null}

      {phase.name === "declined" ? (
        <Alert status="success" title="We won't send you any more reminders" live={false}>
          <p>If you change your mind, open your invitation link again before the survey closes.</p>
        </Alert>
      ) : null}

      {phase.name === "answering" ? (
        <SurveyRunner
          survey={survey}
          settings={settings}
          draft={phase.draft}
          submit={async (draft) =>
            surveyApi.saveTrackedResponse({
              surveyId: survey.surveyId,
              surveyVersion: survey.fingerprint,
              submissionId: draft.submissionId,
              retrySecretHash: await hashRetrySecret(draft.retrySecret),
              trackedPass: draft.trackedPass!,
              answers: draft.answers,
            })
          }
          onSubmitted={() => void complete()}
          onClear={() => {
            clearDraft(survey.surveyId, "tracked");
            const fresh = { ...newDraft(survey.surveyId, survey.fingerprint, "tracked"), answers: defaultAnswers(survey, {}, systemTags) };
            return saveDraft({ ...fresh, trackedPass: phase.draft.trackedPass, passExpiresAt: phase.draft.passExpiresAt }, false);
          }}
        />
      ) : null}

      {phase.name === "completing" ? <p role="status">Your answers have been received. Finishing up…</p> : null}

      {phase.name === "completed" ? (
        <section aria-labelledby="done-heading" className="grid gap-4 rounded-card bg-bg-white-0 p-6 ring-1 ring-stroke-soft-200" role="status">
          <h2 id="done-heading" className="text-title-h5">
            Thank you for taking part
          </h2>
          <p className="text-paragraph-md">We&apos;ve received your response, so you won&apos;t get any more reminders. You can see grouped results from other volunteers, and we&apos;ll email you a link to them too.</p>
          <div>
            <a className="inline-flex min-h-11 items-center rounded-10 bg-brand-primary px-5 text-label-md text-brand-on-primary no-underline" href={resultsAccessUrl(settings.resultsUrl, phase.resultsToken)}>
              See the results so far
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
