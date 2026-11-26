import * as React from "react";
import * as AlignBadge from "@/components/ui/badge";

export type BadgeProps = { children: React.ReactNode };

export function Badge({ children }: BadgeProps) {
  return (
    <AlignBadge.Root variant="lighter" color="purple" size="medium">
      {children}
    </AlignBadge.Root>
  );
}
