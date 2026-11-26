# DistrictSurvey

A survey tool that asks each person only the questions that apply to them, tracks which invited volunteers
have responded, and keeps that tracking apart from what they answered. The design is in
[`docs/designs/district_survey.md`](docs/designs/district_survey.md).

| Part | Where |
| --- | --- |
| Survey site, a static Next.js export | `src/` |
| Response Lambda, which saves answers and never sees invite UUIDs | `functions/response/` |
| Tracking Lambda, which handles invitations and results access and never sees answers | `functions/tracking/` |
| Terraform module, imported by DistrictInfrastructure | `infra/terraform/` |
| Contracts shared with DistrictWorkflow and DistrictStatistics | `contracts/` |

The survey engine (routing, validation and fingerprints) is `@lbdistrictscouts/survey-engine` in
DistrictWorkflow's `packages/survey-engine`.

## Getting started

```bash
corepack enable
# The survey engine comes from GitHub Packages, which needs a token with read:packages.
gh auth refresh -h github.com -s read:packages   # once
export GITHUB_TOKEN=$(gh auth token)
yarn install
yarn dev
```

`yarn dev` uses the made-up survey in `examples/`. To run the APIs too, see
[docs/local-development.md](docs/local-development.md).

## Commands

| Command | Purpose |
| --- | --- |
| `yarn dev`, `yarn dev:all` | The site alone, or the site with the local Lambda server and results proxy |
| `yarn build` | Fetch build data and export the site to `out/` |
| `yarn build:functions` | Bundle both Lambdas into `dist/functions/` |
| `yarn lint`, `yarn typecheck` | ESLint and TypeScript |
| `yarn test`, `yarn test:coverage` | Unit, component and contract tests, with coverage thresholds |
| `yarn test:mutation` | Mutation tests for the signing and S3 record code |
| `yarn test:e2e`, `yarn test:a11y` | Browser and accessibility tests against `out/` |
| `yarn test:stack` | The pull request stack: Moto in Docker, then the browser tests |
| `yarn survey:validate` | Check a survey file and list every question path |
| `yarn secrets:create` | Generate and store an environment's keys |
| `yarn traceability` | Check every assigned goal has a passing tagged test |

## Writing a survey

See [docs/survey-authoring.md](docs/survey-authoring.md).

## Deploying

`deploy.yml` deploys `main` to test, and a `v*` tag to production after approval. Builds run on the cluster runner
named by `SURVEY_RUNNER_LABEL`, fetch the approved survey from DistrictStatistics, and check that the site and
the response Lambda use the same fingerprint. See [infra/terraform/README.md](infra/terraform/README.md) for
setting up an environment.

## Licence

MIT. AlignUI components are MIT too: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
