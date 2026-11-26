"use client";

import * as React from "react";
import * as AlignInput from "@/components/ui/input";

export type InputProps = Omit<React.ComponentPropsWithoutRef<typeof AlignInput.Input>, "hasError" | "size"> & { invalid?: boolean };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ invalid, ...rest }, ref) => (
  <AlignInput.Root hasError={invalid}>
    <AlignInput.Wrapper>
      <AlignInput.Input ref={ref} aria-invalid={invalid || undefined} {...rest} />
    </AlignInput.Wrapper>
  </AlignInput.Root>
));
Input.displayName = "Input";
