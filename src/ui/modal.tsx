"use client";

import * as React from "react";
import * as AlignModal from "@/components/ui/modal";

export type ModalProps = { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children?: React.ReactNode; footer: React.ReactNode };

/** A dialog that traps focus, closes with Escape and returns focus to what opened it. */
export function Modal({ open, onOpenChange, title, description, children, footer }: ModalProps) {
  return (
    <AlignModal.Root open={open} onOpenChange={onOpenChange}>
      <AlignModal.Content showClose={false} className="max-w-md">
        <div className="grid gap-3 p-5">
          <AlignModal.Title className="text-label-lg text-text-strong-950">{title}</AlignModal.Title>
          {description ? <AlignModal.Description className="text-paragraph-md text-text-sub-600">{description}</AlignModal.Description> : null}
          {children}
        </div>
        <AlignModal.Footer className="flex flex-wrap justify-end gap-3">{footer}</AlignModal.Footer>
      </AlignModal.Content>
    </AlignModal.Root>
  );
}
