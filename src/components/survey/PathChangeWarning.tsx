"use client";

import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";

export type PathChangeWarningProps = { open: boolean; count: number; onConfirm: () => void; onCancel: () => void };

/** Warns before removing answers that no longer apply after an earlier answer changed. */
export function PathChangeWarning({ open, count, onConfirm, onCancel }: PathChangeWarningProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? undefined : onCancel())}
      title="Change this answer?"
      description={`Changing this answer means ${count === 1 ? "1 answer you gave no longer applies and will be removed" : `${count} answers you gave no longer apply and will be removed`}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Keep my answer
          </Button>
          <Button onClick={onConfirm}>Change it</Button>
        </>
      }
    />
  );
}
