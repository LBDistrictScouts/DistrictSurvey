# Third-party notices

## AlignUI free Base Components

`src/vendor/alignui/` holds AlignUI components copied unchanged from
[alignui/alignui-nextjs-typescript-starter](https://github.com/alignui/alignui-nextjs-typescript-starter)
at commit `f37bd913a058ceca39d5bfc2369ec420018e5716` (16 February 2025). MIT licence, copyright
Doğukan Çavuş. The licence is in `src/vendor/alignui/LICENSE`.

| File | Source path | Version comment |
| --- | --- | --- |
| `alert.tsx`, `badge.tsx`, `button.tsx`, `checkbox.tsx`, `compact-button.tsx`, `hint.tsx`, `input.tsx`, `label.tsx`, `modal.tsx`, `progress-bar.tsx`, `radio.tsx`, `select.tsx`, `textarea.tsx`, `tooltip.tsx` | `components/ui/` | `v0.0.0` |
| `utils/cn.ts`, `utils/polymorphic.ts`, `utils/recursive-clone-children.tsx` | `utils/` | |
| `tailwind-tokens.ts` | The `texts`, `shadows` and `borderRadii` exports of `tailwind.config.ts`, unchanged | |

`compact-button.tsx` is included because `modal.tsx` imports it.

Two things differ from the starter, both outside `src/vendor`:

- `utils/tv.ts` is replaced by `src/ui/lib/tv.ts`. tailwind-variants 4 moved custom tailwind-merge settings to
  `tailwind-variants/config`, so the original would drop AlignUI's class groups.
- The Tailwind 3 configuration is replaced by the Tailwind 4 tokens in `src/app/globals.css`.

Screens import these components only through `src/ui/`, which ESLint enforces.
