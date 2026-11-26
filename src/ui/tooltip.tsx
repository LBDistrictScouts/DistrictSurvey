"use client";

import * as React from "react";
import * as AlignTooltip from "@/components/ui/tooltip";

export type TooltipProps = { content: string; children: React.ReactElement };

/** A tooltip for extra detail only. It never holds information needed to answer. */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <AlignTooltip.Provider>
      <AlignTooltip.Root>
        <AlignTooltip.Trigger asChild>{children}</AlignTooltip.Trigger>
        <AlignTooltip.Content>{content}</AlignTooltip.Content>
      </AlignTooltip.Root>
    </AlignTooltip.Provider>
  );
}
