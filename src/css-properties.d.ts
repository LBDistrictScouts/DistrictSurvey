// Lets style objects set CSS custom properties, as AlignUI's checkbox does, without editing vendored code.
import "react";

declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
