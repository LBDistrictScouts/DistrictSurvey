"use client";

import { useEffect, useState } from "react";
import type { CompiledSurvey } from "@lbdistrictscouts/survey-engine";
import { surveyApi } from "@/lib/client/api";
import { clearDraft, loadDraft, newDraft, type Draft } from "@/lib/client/drafts";
import { saveReceipt } from "@/lib/client/receipts";
import { formatDate, pageWindowState, type SiteSettings } from "@/lib/config/site";
import { Alert } from "@/ui/alert";
import { SurveyRunner } from "./SurveyRunner";
import { useTurnstile } from "./Turnstile";

type Phase = { name: "loading" } | { name: "before" } | { name: "closed" } | { name: "answering"; draft: Draft; discarded: boolean } | { name: "done" };

export type OpenSurveyProps = { survey: CompiledSurvey; settings: SiteSettings; turnstileSiteKey: string };

/** The open-link survey, offering every persona. */
export function OpenSurvey({ survey, settings, turnstileSiteKey }: OpenSurveyProps) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const { container, getToken } = useTurnstile(turnstileSiteKey);

  useEffect(() => {
    const window = pageWindowState(settings);
    const { draft, discarded } = loadDraft(survey.surveyId, survey.fingerprint, "open");
    // Browser storage is only readable after the page loads, so the phase is set here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window === "before") setPhase({ name: "before" });
    else if (window === "closed" && !draft) setPhase({ name: "closed" });
    else setPhase({ name: "answering", draft: draft ?? newDraft(survey.surveyId, survey.fingerprint, "open"), discarded });
  }, [settings, survey.surveyId, survey.fingerprint]);

  return (
    <>
      {phase.name === "before" ? <Alert status="information" title={`The survey opens on ${formatDate(settings.opensAt)}`} live={false} /> : null}
      {phase.name === "closed" ? (
        <Alert status="information" title="This survey has closed" live={false}>
          <p>Thank you for your interest. The district will share what it heard.</p>
        </Alert>
      ) : null}
      {phase.name === "done" ? (
        <section aria-labelledby="thanks-heading" className="grid gap-3 rounded-card bg-bg-white-0 p-6 ring-1 ring-stroke-soft-200" role="status">
          <h2 id="thanks-heading" className="text-title-h5">
            Thank you, your answers have been received
          </h2>
          <p className="text-paragraph-md">We&apos;ve removed your answers from this device. There&apos;s nothing more you need to do.</p>
        </section>
      ) : null}
      {phase.name === "answering" ? (
        <SurveyRunner
          survey={survey}
          settings={settings}
          draft={phase.draft}
          intro={phase.discarded ? <Alert status="information" title="The survey has changed since you started, so your saved answers were removed." live={false} /> : undefined}
          submit={(draft) => surveyApi.saveOpenResponse({ surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: draft.submissionId, answers: draft.answers }, getToken)}
          onSubmitted={(result) => {
            if (result.receipt && result.receiptExpiresAt) saveReceipt(survey.surveyId, result.receipt, result.receiptExpiresAt);
            clearDraft(survey.surveyId, "open");
            setPhase({ name: "done" });
          }}
          onClear={() => {
            clearDraft(survey.surveyId, "open");
            return newDraft(survey.surveyId, survey.fingerprint, "open");
          }}
        />
      ) : null}
      <div ref={container} />
    </>
  );
}
