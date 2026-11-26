"use client";

import * as React from "react";
import * as AlignSelect from "@/components/ui/select";

export type SelectProps = { id: string; value?: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder: string; labelledBy: string };

export function Select({ id, value, onChange, options, placeholder, labelledBy }: SelectProps) {
  return (
    <AlignSelect.Root value={value} onValueChange={onChange}>
      <AlignSelect.Trigger id={id} aria-labelledby={labelledBy}>
        <AlignSelect.Value placeholder={placeholder} />
      </AlignSelect.Trigger>
      <AlignSelect.Content>
        {options.map((option) => (
          <AlignSelect.Item key={option.value} value={option.value}>
            {option.label}
          </AlignSelect.Item>
        ))}
      </AlignSelect.Content>
    </AlignSelect.Root>
  );
}
