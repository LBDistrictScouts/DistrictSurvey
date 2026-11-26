<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# district-survey

The district survey: a static Next.js survey site, two AWS Lambda functions, the survey Terraform module and
the contracts shared with DistrictWorkflow and DistrictStatistics. The design is
`docs/designs/district_survey.md`.

## Package manager

Use Yarn through Corepack. The version is pinned by `packageManager` in `package.json`. Never use npm, npx or pnpm, and never commit a `package-lock.json`.

The survey engine, `@lbdistrictscouts/survey-engine`, lives in `DistrictWorkflow/packages/survey-engine` and is
installed from GitHub Packages at a pinned version. `yarn install` needs `GITHUB_TOKEN` set to a token with
`read:packages`, such as `$(gh auth token)` after `gh auth refresh -s read:packages`. To change the engine,
publish a new version from DistrictWorkflow by pushing a `survey-engine-v<version>` tag, then update the
version in `package.json` here.

## Commands

- `yarn dev`: the survey site on port 3000, with example build data
- `yarn dev:all`: the site, the local Lambda server on 8787 and the results proxy on 8788
- `yarn build`: build data, then export the static site to `out/` with inline scripts moved into files
- `yarn build:functions`: bundle each Lambda into `dist/functions/`
- `yarn lint`, `yarn typecheck`
- `yarn test`, `yarn test:coverage`, `yarn test:mutation`
- `yarn test:e2e`, `yarn test:a11y` (after `yarn build`), `yarn test:stack` (with Moto in Docker)
- `yarn survey:validate <file> [--previous <file>] [--settings <file>]`
- `yarn contracts:lint`, `yarn contracts:types`
- `yarn secrets:create --env <local|test|prod> --generate|--store`

Run `yarn lint`, `yarn typecheck`, `yarn test:coverage` and `yarn build` before calling a change finished. For
`infra/terraform`, run `terraform fmt -check -recursive` and `terraform test`.

## The two-Lambda boundary

- The **response Lambda** (`functions/response`) saves answers. It never receives an invite UUID or a tracked link.
- The **tracking Lambda** (`functions/tracking`) handles tracked links, receipts and results access. It never receives answers.
- Neither imports the other's code (ESLint enforces this), each lists only its own secrets, and
  `tests/functions/bundle-separation.test.ts` fails if either bundle contains the other's code or secret names.
- Stored answer and comment files hold only the fields in `contracts/schemas/answer-file.v1.json` and
  `comment-file.v1.json`. `tests/functions/stored-fields.test.ts` fails on any other field.
- Each request writes one log entry with only the fields in `allowedLogFields` in `functions/shared/logger.ts`.
  Never log answers, tokens, UUIDs, IP addresses, user agents or error messages.

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
- `src/components/survey/`: the survey screens
- `src/ui/`: the only import point for AlignUI components, which are vendored unchanged in `src/vendor/alignui/`
- `src/lib/`: browser storage, API calls, build data and contract types
- `functions/`: the Lambdas, their shared services and the local server
- `contracts/`: JSON Schemas, OpenAPI files and reviewed examples
- `infra/terraform/`: the survey module and its tests
- `examples/`: made-up surveys and settings. Public code never holds district names, domains or contacts
- `public/`: static assets copied into the export
- The `@/*` import alias maps to `src/*`
