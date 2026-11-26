"use client";

import * as React from "react";
import * as AlignRadio from "@/components/ui/radio";
import { cn } from "@/utils/cn";

export type RadioOption = { value: string; label: string };

export type RadioGroupProps = {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange: (value: string) => void;
  labelledBy: string;
  describedBy?: string;
  required?: boolean;
  invalid?: boolean;
};

/** A labelled group of radio buttons. Arrow keys move between options, as in a native radio group. */
export function RadioGroup({ name, options, value, onChange, labelledBy, describedBy, required, invalid }: RadioGroupProps) {
  return (
    <AlignRadio.Group
      name={name}
      value={value ?? ""}
      onValueChange={onChange}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-required={required}
      aria-invalid={invalid}
      className="grid gap-2"
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-10 bg-bg-white-0 px-4 py-2.5 text-paragraph-md text-text-strong-950 ring-1 ring-inset ring-stroke-sub-300 transition",
              "hover:ring-primary-base has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary-base",
            )}
          >
            <AlignRadio.Item id={id} value={option.value} />
            <span>{option.label}</span>
          </label>
        );
      })}
    </AlignRadio.Group>
  );
}
