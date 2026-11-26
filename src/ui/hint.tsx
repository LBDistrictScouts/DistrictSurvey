import * as React from "react";
import * as AlignHint from "@/components/ui/hint";
import { cn } from "@/utils/cn";

export type HintProps = { id: string; error?: boolean; children: React.ReactNode; className?: string };

/** Help or error text linked to its field with aria-describedby. Errors are announced as they appear. */
export function Hint({ id, error, children, className }: HintProps) {
  return (
    <AlignHint.Root id={id} hasError={error} role={error ? "alert" : undefined} className={cn("text-paragraph-sm", className)}>
      {children}
    </AlignHint.Root>
  );
}
