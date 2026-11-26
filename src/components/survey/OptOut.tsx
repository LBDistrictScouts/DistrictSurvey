"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";

export const optOutText = "I don't want to complete the survey, please suppress any further reminders for this survey.";

export type OptOutProps = { onDecline: () => Promise<boolean> };

/** The reminder opt-out, with a confirmation step. */
export function OptOut({ onDecline }: OptOutProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const decline = async () => {
    setBusy(true);
    const ok = await onDecline();
    setBusy(false);
    if (ok) setConfirming(false);
  };

  return (
    <>
      <Button variant="quiet" onClick={() => setConfirming(true)} className="h-auto whitespace-normal py-2 text-left">
        {optOutText}
      </Button>
      <Modal
        open={confirming}
        onOpenChange={setConfirming}
        title="Stop reminders for this survey?"
        description="We won't send you any more reminders about this survey. You can still take part using your link until the survey closes."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Go back
            </Button>
            <Button onClick={decline} disabled={busy}>
              Stop reminders
            </Button>
          </>
        }
      />
    </>
  );
}
