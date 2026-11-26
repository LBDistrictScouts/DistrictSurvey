"use client";

import * as React from "react";
import * as AlignTextarea from "@/components/ui/textarea";

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  invalid?: boolean;
  counterId: string;
};

/** A text box with a character count that screen readers read with the field. */
export function Textarea({ value, onChange, maxLength, invalid, counterId, ...rest }: TextareaProps) {
  const describedBy = [rest["aria-describedby"], counterId].filter(Boolean).join(" ");
  return (
    <AlignTextarea.Root
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={maxLength}
      hasError={invalid}
      aria-invalid={invalid || undefined}
      rows={5}
      className="min-h-32 text-paragraph-md"
      {...rest}
      aria-describedby={describedBy}
    >
      <span id={counterId} aria-live="polite">
        <AlignTextarea.CharCounter current={value.length} max={maxLength} />
        <span className="sr-only"> characters used</span>
      </span>
    </AlignTextarea.Root>
  );
}
