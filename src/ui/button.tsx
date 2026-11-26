"use client";

import * as React from "react";
import * as AlignButton from "@/components/ui/button";
import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "quiet";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

// Primary buttons are white on Scouts Purple in both themes. AlignUI's primary colour is the lighter
// purple in the dark theme, so the brand classes replace it here.
const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-primary text-brand-on-primary hover:bg-primary-darker focus-visible:shadow-none",
  secondary: "",
  quiet: "",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ variant = "primary", className, type = "button", children, ...rest }, ref) => (
  <AlignButton.Root
    ref={ref}
    type={type}
    variant={variant === "primary" ? "primary" : "neutral"}
    mode={variant === "primary" ? "filled" : variant === "secondary" ? "stroke" : "ghost"}
    size="medium"
    className={cn("min-h-11 px-5 text-label-md", variantClasses[variant], className)}
    {...rest}
  >
    {children}
  </AlignButton.Root>
));
Button.displayName = "Button";
