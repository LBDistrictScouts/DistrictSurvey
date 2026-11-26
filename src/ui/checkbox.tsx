"use client";

import * as React from "react";
import * as AlignCheckbox from "@/components/ui/checkbox";
import { cn } from "@/utils/cn";

export type CheckboxProps = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  describedBy?: string;
};

/** A checkbox inside its own label, so the whole row can be clicked. Space toggles it. */
export function Checkbox({ id, label, checked, onChange, describedBy }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-10 bg-bg-white-0 px-4 py-2.5 text-paragraph-md text-text-strong-950 ring-1 ring-inset ring-stroke-sub-300 transition",
        "hover:ring-primary-base has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary-base",
      )}
    >
      <AlignCheckbox.Root id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} aria-describedby={describedBy} />
      <span>{label}</span>
    </label>
  );
}
