import * as React from "react";
import * as AlignLabel from "@/components/ui/label";
import { cn } from "@/utils/cn";

export type LabelProps = React.ComponentPropsWithoutRef<typeof AlignLabel.Root> & { required?: boolean };

export function Label({ required, className, children, ...rest }: LabelProps) {
  return (
    <AlignLabel.Root className={cn("text-label-md text-text-strong-950", className)} {...rest}>
      {children}
      {required ? <span className="sr-only"> (required)</span> : null}
    </AlignLabel.Root>
  );
}
