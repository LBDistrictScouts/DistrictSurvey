// Stands in for AlignUI's utils/tv.ts, which the `@/utils/tv` alias points here. tailwind-variants 4
// moved custom tailwind-merge configuration to its /config entry, so AlignUI's own file would
// silently drop its text, shadow and radius class groups and merge classes wrongly.
import { createTV } from "tailwind-variants/config";
import { twMergeConfig } from "@/utils/cn";

export type { VariantProps, ClassValue } from "tailwind-variants";

export const tv = createTV({ twMergeConfig });
