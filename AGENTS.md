<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# district-survey

A React app built with Next.js (App Router), TypeScript and Tailwind CSS, deployed as a fully static site.

## Package manager

Use Yarn through Corepack. The version is pinned by `packageManager` in `package.json`. Never use npm, npx or pnpm, and never commit a `package-lock.json`.

## Commands

- `yarn dev`: start the development server on port 3000
- `yarn build`: export the static site to `out/`
- `yarn lint`: run ESLint
- `yarn typecheck`: check types

Run `yarn lint`, `yarn typecheck` and `yarn build` before calling a change finished.

## Static export constraints

`output: "export"` is set in `next.config.ts`, so nothing can depend on a server at runtime. Do not use:

- Server Actions, or Route Handlers that read the request
- `cookies()`, `headers()`, or Proxy
- Rewrites, redirects, or custom headers in `next.config.ts`
- Incremental Static Regeneration, Draft Mode, or Cache Components
- Dynamic routes without `generateStaticParams()`

Server Components run only at build time. Anything that happens at runtime, including reading or submitting data, belongs in a Client Component (`"use client"`).

## Layout

- `src/app/`: routes, layouts and global styles
- `public/`: static assets copied into the export
- The `@/*` import alias maps to `src/*`
