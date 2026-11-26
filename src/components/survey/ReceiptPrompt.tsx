"use client";

import { Button } from "@/ui/button";

export type ReceiptPromptProps = { busy?: boolean; onAlreadyResponded: () => void; onNotResponded: () => void };

/**
 * Shown when a tracked link opens on a device that holds an open-link receipt. Another person may
 * share the device, so the page always asks.
 */
export function ReceiptPrompt({ busy, onAlreadyResponded, onNotResponded }: ReceiptPromptProps) {
  return (
    <section aria-labelledby="receipt-heading" className="grid gap-4 rounded-card bg-bg-white-0 p-6 ring-1 ring-stroke-soft-200">
      <h2 id="receipt-heading" className="text-title-h6">
        Have you already answered this survey?
      </h2>
      <p className="text-paragraph-md">
        Someone using this device answered the survey through the public link. If that was you, we can count that response for your invitation, so you don&apos;t need to answer again.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onAlreadyResponded} disabled={busy}>
          Yes, that was me
        </Button>
        <Button variant="secondary" onClick={onNotResponded} disabled={busy}>
          No, I haven&apos;t answered yet
        </Button>
      </div>
    </section>
  );
}
