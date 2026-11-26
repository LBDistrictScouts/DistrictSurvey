# Goldfish Annotated Review Report, Round 2

**Target:** `docs/designs/district_survey.md` (DetailedRange, lines 1229-1749)

**Status:** resolved

**Outcome:** 48 fixes applied (several with owner changes), 1 escalated finding decided by the owner (codebase-2-3: option B, 30-day retention stated in the privacy notice), 0 contested, 0 declined. Owner changes during the walkthrough: survey statuses added to the shared `tasks` enum with survey tasks in personal digests; the survey engine moved to `DistrictWorkflow/packages/survey-engine`; opt-out wording for reminders; DistrictStatistics keeps all answers, with only the public survey and results data removed after 3 months; shared `emails` and `email_traces` tables, with tracking set by SES configuration set; results served from a new DistrictStatistics `data-viz` front end, with staff access after the public window for `survey-analyst` and `survey-admin`.

**Re-audit limit:** Stage 9 has used its one re-audit. Fixes applied from this report will not be audited again by this review.

## Summary

| Category | Findings |
| --- | --- |
| PROPOSE FIX | 48 |
| ESCALATE | 1 |
| CONTEST | 0 |
| DECLINE | 0 |
| **Total** | **49** |

## Prioritized Findings & AI Suggestions

### [Issue 1] codebase-2-1: DistrictWorkflow task model is undecided and contradicts the existing schema (round-1 readiness-1-5, fix failed) [`egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)] - Severity: Blocker
*   **Affected Scope:** Lines 806, 822, 1520-1524, 1555, 1567
*   **Discrepancy Description:** Line 1520 names `survey_invitations`, `survey_comment_tasks` and `survey_import_runs` but gives no columns, keys or indexes. The plan does not say whether survey tasks are rows in the shared `tasks` table. The design's statuses (`pending, sent, bounced, started, completed, declined, not_completed`, line 806) do not fit the existing enum `['pending','in_progress','completed']` (`DistrictWorkflow/packages/persistence/src/schema.ts:75`). Shared tasks need a published workflow, a definition, steps, a task type and a tag (`schema.ts:149-173`, `docs/workflow-data-model.md:46-60`). No seed migration creates these, or the `survey-admin`, `survey-reviewer` and `survey-analyst` tags. Line 1521 says the migration is generated with `db:generate`, which produces no seed rows. Existing workflows are seeded by hand-written SQL (`migrations/0014_workflow_cases.sql:36`). "Forward-only task status" (1524, 1567) has no defined order, and `bounced` and `declined` do not fit a single order. Line 822 needs an audit table that does not exist. Only `tasks.audit_notes` exists (`schema.ts:168`). The existing digest selects tasks by assigned user or tag membership (`task-digest-repository.ts:24-36`). A tag-assigned survey task could therefore show one volunteer's task to every tag member, which breaks the rule that named status is visible to `survey-admin` only (235).
*   **Rationale:** Two builders would build incompatible schemas. Choose shared tasks or survey-only tables. Give a column table for each DistrictWorkflow table, matching the DistrictStatistics table at lines 710-720. List the allowed status transitions and how they map to the shared enum. Add a hand-written seed migration row and an audit table. State whether tasks are assigned by user or by tag. Add a test that no survey task appears in another user's digest.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The owner described invitations as DistrictWorkflow tasks assigned through tags, so the shared `tasks` table is the right home. Its three statuses can carry the survey's detail in a separate column.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Use the shared `tasks` table. Map `pending` and `sent` to `pending`, `started` to `in_progress`, and `completed`, `declined` and `not_completed` to `completed`, with the detailed status in `survey_invitations.status` and an allowed transition table. Assign invitation tasks to the volunteer through `assigned_user_id`, give them a `survey-invitee` tag with no members, and exclude them from the task digest. Assign comment tasks to the `survey-reviewer` tag. Add column tables for `survey_invitations`, `survey_comment_tasks`, `survey_import_runs`, `survey_email_claims` and `survey_audit_log`, and a hand-written seed migration for the workflow, steps and tags. Add a test that no invitation task appears in another user's digest.

### [Issue 2] codebase-2-2: The survey engine package has no name, build or distribution [`egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)] - Severity: Blocker
*   **Affected Scope:** Lines 569, 1362, 1438, 1527, 1547
*   **Discrepancy Description:** DistrictWorkflow's upload page validates with "the pinned survey engine package" (1527). `district-survey/package.json` is `"private": true`, has no `exports` and has no library build. `release.yml` (1438) publishes only Lambda bundles and the contracts release. The validator runs in `apps/web` (552, 569), but only `packages/integrations/package.json` is changed. `apps/web/package.json` and DistrictWorkflow's root `yarn.lock` are not listed.
*   **Rationale:** CUJ 9 and Phase 5 depend on installing this package. Name the package, its build command and its output. State where it is published (GitHub Packages, a release tarball with a checksum, or inside the contracts release) and the versioning rule. List every DistrictWorkflow manifest and lockfile that changes.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** DistrictWorkflow cannot install a package that is never built or published. The district already publishes `@lbdistrictscouts/district-styles` through GitHub Packages.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Publish `src/lib/survey-engine` as `@lbdistrictscouts/survey-engine` to GitHub Packages from `release.yml`, built with `tsc` into `dist/` with `exports`. Its version matches the release tag. Add a `packages/survey-engine/package.json` workspace, and list `apps/web/package.json`, `packages/integrations/package.json` and DistrictWorkflow's `yarn.lock` as changing.

### [Issue 3] codebase-2-3: The 14-day Temporal history promise conflicts with the hosting design and with how Temporal retention works [`egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** Lines 129-135 (G25), 237, 826-837, 847, 1209
*   **Discrepancy Description:** DistrictWorkflow's hosting design sets 30-day retention for the shared `district-workflow` namespace and requires more than 14 days (`DistrictWorkflow/docs/designs/kubernetes-deployment.md:99, 233, 269-271`). The worker connects to a single namespace (`packages/integrations/src/temporal/config.ts:3`). Retention also starts only when a workflow closes. Invitation, reminder and close-down workflows run for months (836-837), so their histories outlive 14 days under any setting (general knowledge, not tested).
*   **Rationale:** This does not reopen the settled hosting split. The design text itself makes a promise to respondents (G25) that the listed hosting requirements cannot keep. Either run survey workflows in a separate namespace with 14-day retention, and list the worker connection changes and the hosting requirement at 847, or reword G25 and line 237. Also make the long-running workflows close regularly, using short child runs or Continue-As-New.
*   ***AI Suggestion:*** ESCALATE
*   ***Justification:*** The design promises 14 days of Temporal history, but the owner's DistrictWorkflow hosting design sets 30 days for the shared namespace, and Temporal counts retention from when a workflow closes. Only the owner can choose between a separate namespace and changing the promise.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Owner to choose: a separate `district-survey` Temporal namespace with 14-day retention, or changing G25 to 30 days. Either way, long-running survey workflows close each day and continue as new runs.

### [Issue 4] codebase-2-4: Reviewer pool notification relies on a 72-hour digest that cannot meet the 48-hour review limit [`egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** Lines 779, 783-784, 1534, 1559
*   **Discrepancy Description:** Line 779 relies on DistrictWorkflow's existing notification batching. That batching is `taskDigestWorkflow`, which runs every 72 hours and only for users with the `task-notification` preference (`DistrictWorkflow/docs/reusable-activities.md:256-277`, `apps/worker/src/commands/schedule-task-digest.ts:12-16`). The `email.ts` row lists "review emails", but no workflow step sends the first pool email.
*   **Rationale:** Comment review within 48 hours (G16) is a safeguarding launch condition. Replace line 779 with an explicit pool email sent by the import workflow when it creates the task. State the recipients (every active `survey-reviewer` member) and how duplicate emails are prevented.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The 72-hour digest cannot meet the 48-hour review limit. The earlier change relied on it without checking its schedule.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: The import workflow sends one email to every active `survey-reviewer` member after each import that creates review tasks, listing the count and linking to the task page. A claim row in `survey_email_claims` stops duplicates. Reminders at 12 and 24 hours are sent the same way.

### [Issue 5] readiness-2-1: The grace period cannot work as specified [`egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** Lines 172-174 (G21), 443-444, 1391, 1459
*   **Discrepancy Description:** G21 accepts submissions for 1 hour after close if the person started before the deadline. Tracked passes expire at close (444), so every tracked submission in the grace hour fails. For open-link submissions, the server records no trusted start time.
*   **Rationale:** Choose a rule. For example, set the pass `exp` to close + 1 hour, and either accept any open submission in that hour or issue a signed start value. Record the rule in `signed-values.v1.json` and test it in `survey-window.test.ts`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Tracked passes expire at close, and open-link submissions carry no trusted start time.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Set pass and receipt expiry to close + 1 hour. Accept any open-link submission during the grace hour, because a person cannot reach the survey page without starting before close. Record the rule in `signed-values.v1.json` and test it in `survey-window.test.ts`.

### [Issue 6] readiness-2-2: Spam comments cannot be removed by source [`egm-implementation-readiness` (also `egm-codebase-details`)] - Severity: Major
*   **Affected Scope:** Lines 461-476, 718, 817, 973, 1587, 1606
*   **Discrepancy Description:** Spam removal selects "by date and source" and marks matching responses and comments. Comment files and `survey_comments` have no `source` field, and comments carry no submission ID. Removing open-link spam would therefore remove tracked comments too, or no comments at all.
*   **Rationale:** Add `source` to the comment file schema and the table, or state that comments are removed by date only or reviewed by hand.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Spam removal by source needs the source on comments too.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `source` to the comment file schema and `survey_comments`, and remove comments by date and source like responses.

### [Issue 7] readiness-2-3: Declining has no route, event or screen [`egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** Lines 484, 591-599, 803, 806, 1560
*   **Discrepancy Description:** Line 803 says a person can decline from their link, and `declined` is a task status. No tracking route accepts a decline, the completion message `event` allows only `started` or `completed`, and no page or component offers the choice.
*   **Rationale:** Add a decline route (for example `POST /api/v1/tracking/decline`), a `declined` event in the completion message schema, the component and its tests. Otherwise remove decline from the design.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Decline is in the lifecycle but has no route or event.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `POST /api/v1/tracking/decline`, a `declined` completion event, a decline option on `/invite`, and tests.

### [Issue 8] readiness-2-4: Wording fixes clash with the unique fingerprint, and nothing freezes the fingerprint [`egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** Lines 546-548, 571-574, 713, 1581
*   **Discrepancy Description:** Wording fixes are left out of the fingerprint so that drafts survive. But `survey_versions` requires the fingerprint to be unique within a survey, so an approved wording fix after opening cannot be stored as a new version. Nothing names what freezes the fingerprint "when the survey opens": no workflow step, API check or schedule.
*   **Rationale:** Apply uniqueness to a content hash or a version number. Name the component that freezes the fingerprint, and test it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Wording fixes create new versions with the same fingerprint, and nothing freezes it.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Make `survey_versions` unique on survey ID and version number, with the fingerprint not unique. The DistrictWorkflow survey controls page has an Open survey action that freezes the fingerprint, and DistrictStatistics then refuses versions with a different fingerprint. Test both.

### [Issue 9] codebase-2-5: Results bucket keys do not match the results URL [`egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)] - Severity: Major
*   **Affected Scope:** Lines 733-735, 742, 1308, 1328, 1393, 1416, 1591
*   **Discrepancy Description:** The publisher writes `results/{surveyId}/...`, but the page requests `/results-data/{surveyId}/current.json`. CloudFront passes the path to S3 unchanged, and an origin path can only add a prefix. No rewrite function is listed, and `clean-urls.js` handles page addresses only. The contracts do not say whether `current.json` is a copy of the release or a pointer to it. If it is a pointer, the page makes two requests.
*   **Rationale:** `cloudfront.tf`, `SurveyResultsPublisher.php` and `results-proxy.ts` sit in different repositories and phases. Use one key prefix, for example `results-data/`, or add a named rewrite function. Define `current.json` in `results-release.v1.json`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** CloudFront passes the path unchanged, so the bucket keys must match the URL.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Write results under `results-data/{surveyId}/`, and define `current.json` as a copy of the latest release in `results-release.v1.json`, so the page makes one request.

### [Issue 10] codebase-2-6: Module inputs, outputs and IAM actions are incomplete [`egm-codebase-details` (also `egm-implementation-readiness`)] - Severity: Major
*   **Affected Scope:** Lines 830-837, 868, 879, 1174-1177, 1427, 1486, 1510
*   **Discrepancy Description:** Module inputs have no types. DistrictWorkflow needs several values that are not outputs: the feedback queue URL, the SES configuration set name, the used-records bucket, the SSM parameter names, the secret ARNs and the WAF ACL. `route53_zone_id` needs a root lookup, and existing modules look zones up by name (`modules/certificates/main.tf:1-3`). `iam.tftest.hcl` checks "only its listed actions and resources", but no list exists. Close-down, results publishing, archive reading and metric publishing each need actions that nothing names. The `output.tf` row (1510) does not say which outputs it exposes.
*   **Rationale:** List every input with its type and every output. Add a table of actions and resource ARNs for each role and policy, so the IAM test has something to check against.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The IAM test needs a list to check against.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: List every module input with its type and every output. Add an IAM table giving each role and policy its actions and resource ARNs, including close-down deletion, results publishing, archive reading and metric publishing. Look up the Route 53 zone by name in the root, as `modules/certificates` does.

### [Issue 11] codebase-2-7: The firewall attachment point and the open-route toggle are undefined [`egm-codebase-details` (also `egm-implementation-readiness`)] - Severity: Major
*   **Affected Scope:** Lines 815, 862, 867, 1426, 1532
*   **Discrepancy Description:** AWS WAF cannot be attached to an API Gateway HTTP API (general knowledge, not tested). The open-route rule would need to sit on the CloudFront web ACL in us-east-1, scoped to `/api/v1/responses/open`. Line 815 says closing the open route turns on its firewall block, but DistrictWorkflow's `controls.ts` only updates SSM, and no WAF permission or client is listed.
*   **Rationale:** State the WAF scope and provider alias, how the rule is switched on and off, and which role is allowed to switch it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** AWS WAF cannot be attached to an HTTP API, so the rule belongs on CloudFront.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Attach a CloudFront web ACL in `us-east-1` with a per-connection rate rule scoped to `/api/v1/responses/open`. It is enabled by a Terraform variable for the survey period. The open-route close switch stays in SSM and is applied by the Lambda, with the route's own throttle protecting tracked routes.

### [Issue 12] readiness-2-6: Contracts shared between repositories are still missing (round-1 readiness-1-3 and readiness-1-4 leftovers) [`egm-implementation-readiness` (also `egm-codebase-details`)] - Severity: Major
*   **Affected Scope:** Lines 405-430, 499, 634, 680-682, 958-959, 1308, 1345, 1390, 1428, 1530-1533, 1581-1592
*   **Discrepancy Description:** These are not defined, although two repositories must agree on each:
  * The archive format, compression, key and checksum. DistrictWorkflow (TypeScript) writes the archive and `SurveyArchiveRestoreCommand.php` reads it.
  * The comment file prefix and the full intake key layout. Only `intake/answers/{fileKey}` is given.
  * The import request body, and how `batchId` is created.
  * The fields of the results release, including hidden groups, which `ResultsList.tsx` renders.
  * The names and value formats of the SSM control parameters. DistrictWorkflow's `controls.ts` writes them and the Lambda's `controls.ts` reads them.
  * The CloudWatch namespace and metric names. DistrictWorkflow's `metrics.ts` publishes them and `alarms.tf` watches them.
  * Who switches the import alarms on and off, and how.
  * Most DistrictStatistics API routes (versions, comments, releases, dashboard, removals, evidence), with method, token scope and status codes.
  * The survey format leftovers listed under readiness-1-4 in the status table.
*   **Rationale:** Add each of these to "Shared contracts" with its own schema file, and add the routes to `statistics-api`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Two repositories must agree on each of these formats.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add schema files for the archive, intake key layout, import request, results release, SSM parameters and metric names, and add every DistrictStatistics route to `statistics-api.v1.yaml` with method, token scope and status codes. Complete the survey format leftovers: `scale` fields, comment questions, `audience`, setting keys and visible-question precedence. The import workflow switches the import alarms on at opening and off after close-down.

### [Issue 13] readiness-2-7: Who deletes what at close-down is undefined [`egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** Lines 835-837, 1530, 1535
*   **Discrepancy Description:** Close-down deletes used-link and receipt records, destroys HMAC and Ed25519 keys, and removes results data at close + 3 months. In DistrictWorkflow, `storage.ts` covers intake files only and `controls.ts` covers SSM only. No file owns these deletions, and no client or permission allows them.
*   **Rationale:** Name the activity file for each deletion, the AWS client it uses, and the IAM action it needs (see codebase-2-6).
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** No file owns these deletions.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `apps/worker/src/activities/survey/close-down.ts`, using S3 and Secrets Manager clients, and list the IAM actions it needs in the codebase-2-6 table.

### [Issue 14] codebase-2-8: DistrictWorkflow AWS SDK packages are missing [`egm-codebase-details` (also `egm-implementation-readiness`)] - Severity: Major
*   **Affected Scope:** Lines 1386, 1527, 1532-1533
*   **Discrepancy Description:** Only `@aws-sdk/client-s3` is added. `controls.ts` needs SSM, `metrics.ts` needs CloudWatch, key destruction needs Secrets Manager, and a firewall toggle would need WAFv2. The worker declares only `client-sesv2` and `client-sqs` (`apps/worker/package.json:30-32`). In `district-survey`, `functions/shared/metrics.ts` needs either a CloudWatch client or a statement that it uses Embedded Metric Format, which `logger.ts` would then have to allow.
*   **Rationale:** List each package with its version and the workspace that declares it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The worker lacks the AWS clients the plan needs.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `@aws-sdk/client-s3`, `client-ssm`, `client-cloudwatch` and `client-secrets-manager` 3.1173.0 to `packages/integrations/package.json`. In `district-survey`, `metrics.ts` uses `@aws-sdk/client-cloudwatch` 3.1173.0.

### [Issue 15] codebase-2-9: The local and pull request stack contradicts the Environments table and existing DistrictWorkflow setup [`egm-codebase-details` (also `egm-style`, `egm-implementation-readiness`)] - Severity: Major
*   **Affected Scope:** Lines 392-401, 1294, 1634-1651
*   **Discrepancy Description:** Line 392 runs DistrictWorkflow and DistrictStatistics as local containers, but line 1643 uses mock services generated from OpenAPI files. DistrictWorkflow has no OpenAPI file (429-430). The mock tool is unnamed (readiness-1-17). No row says which repository's compose file runs the real containers. "DistrictWorkflow tasks and emails: Mocked" (1651) does not say what the mock is. DistrictWorkflow checks sign-in tokens against a hard-coded Cognito issuer (`apps/web/src/lib/cognito.ts:16-18, 27, 33`), so a "mock sign-in service" needs a DistrictWorkflow change that is not listed. DistrictWorkflow already starts Moto on port 4566 (`docs/training-fund.md:270-275`), so a second Moto in `docker-compose.yml` would clash. Moto already captures SES mail, and a real dev Cognito client with a localhost callback already exists (`DistrictInfrastructure/modules/workflow/README.md:33-39`).
*   **Rationale:** Split the section into "Local development" and "Pull request stack". For each service, say whether it is a real container (and from which compose file) or a named mock. Reuse DistrictWorkflow's Moto and dev Cognito client, or list the DistrictWorkflow changes that make the issuer configurable. Name and pin the mock tool.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The local stack and pull request stack are different things, and DistrictWorkflow already runs Moto and has a dev Cognito client.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Split the section. Local development runs the real DistrictWorkflow and DistrictStatistics from their own compose files, shares DistrictWorkflow's Moto on port 4566, and uses the existing dev Cognito client with its localhost callback. The pull request stack mocks only DistrictStatistics, using Prism from `statistics-api.v1.yaml`, and reads completion messages from Moto instead of running DistrictWorkflow. Remove the mock sign-in service and separate mail capture.

### [Issue 16] codebase-2-10: PHP tooling commands and packages are not defined [`egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)] - Severity: Major
*   **Affected Scope:** Lines 1269-1270, 1575, 1663, 1672-1676
*   **Discrepancy Description:** `composer phpstan` (1675) does not exist. `DistrictStatistics/data-core/composer.json:46-56` defines only `check`, `cs-check`, `cs-fix` and `test`. No `phpstan.neon` row sets level 8 (1663). "An OpenAPI request validator" and the PHP JSON Schema validator have no package names or versions. "Sign in to the test AWS account" names no profile or role. Style also flagged `yarn typecheck` and `yarn lint`, but both already exist in `district-survey/package.json`, so that part is not a gap.
*   **Rationale:** Add the Composer script and the PHPStan config row, name each Composer package with its version constraint, and name the AWS profile or role.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** `composer phpstan` and the PHP packages are undefined.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `phpstan.neon` at level 8 and a `phpstan` Composer script, following `district-team`. Name the Composer packages with version constraints: `aws/aws-sdk-php` ^3, `league/openapi-psr7-validator` and `opis/json-schema` ^2, with exact versions recorded in Phase 4. Name the test AWS profile `lbd-survey-test`.

### [Issue 17] codebase-2-11: The DistrictStatistics CI file path is ambiguous, and the file includes deployment work [`egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)] - Severity: Major
*   **Affected Scope:** Lines 1569, 1571, 1595
*   **Discrepancy Description:** The table is headed `data-core/`, so `.github/workflows/ci.yml` would resolve to `data-core/.github/...`. GitHub reads workflows only from the repository root. Line 1571 says deployment files belong to the hosting plan, but the `ci.yml` row includes image build, publishing to GHCR and a protected release. These need a Dockerfile, which the hosting plan owns.
*   **Rationale:** Give the path from the repository root with `working-directory: data-core`. Either remove the deployment steps or state the boundary with the hosting plan and name the Dockerfile dependency.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** GitHub reads workflows from the repository root, and image builds belong with the Dockerfile in the hosting plan.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Use `.github/workflows/ci.yml` at the DistrictStatistics repository root with `working-directory: data-core`. Keep the tests, analysis and contract checks here, and move the image build, publish and release jobs to the hosting plan.

### [Issue 18] codebase-2-12: The DistrictWorkflow web file list omits required integration points [`egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Lines 763-770, 1545-1555
*   **Discrepancy Description:** The task modal dispatches on `task.kind` from `lib/task-reference.ts:1-18` (`components/tasks/task-modal.tsx:6-9, 60`). `survey-comment-review.tsx` cannot open unless both files change. `app/workflows/page.tsx:12` hard-codes the workflow cards. `workflowCaseSummary` uses `workflowOverviewRepository().caseSummary(slug)` (`workflow-overview-repository.ts:8-22`). No helper exists for tag-based page access: `workflow-tasks.ts:11-14` checks only that a user is signed in. `apps/web/package.json` and the root `yarn.lock` are not listed.
*   **Rationale:** Add rows for these files and for a new tag-check helper, with a test.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The task modal and workflow pages need wiring.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add rows for `lib/task-reference.ts`, `components/tasks/task-modal.tsx`, `app/workflows/page.tsx`, `workflow-overview-repository.ts`, a new `lib/survey-access.ts` tag-check helper with a test, `apps/web/package.json` and the root `yarn.lock`.

### [Issue 19] codebase-2-13: The survey's SES configuration set cannot be used through the shared sender [`egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Lines 800, 1425, 1534, 1541
*   **Discrepancy Description:** `deliverThemedEmail` builds `SendEmail` without `ConfigurationSetName` (`packages/integrations/src/email/ses.ts:20-35`), and `ses.ts` is not in the file list. DistrictWorkflow's sending identities already route bounces to the shared queue (`DistrictInfrastructure/modules/transactional-email/feedback.tf:1-6`), so survey bounces would arrive twice. The shared feedback SNS topic accepts only SES identity source ARNs (`feedback/main.tf:20-22`). SES event destinations cannot target SQS directly (general knowledge, not tested).
*   **Rationale:** Add the `ses.ts` change. In `email.tf`, specify the SNS topic, its policy and the subscription. State how the shared-queue consumer ignores survey bounces.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The shared sender has no configuration set option, and SES event destinations cannot target SQS directly.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add an optional `configurationSetName` to `deliverThemedEmail` in `packages/integrations/src/email/ses.ts`. In `email.tf`, the survey configuration set sends events to a survey SNS topic with a policy allowing SES, subscribed by the survey feedback queue. The shared queue's identity notifications are ignored for survey sends, because nothing consumes that queue for survey email.

### [Issue 20] codebase-2-14: The "existing delivery records" cited for email claims do not exist [`egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Line 1538
*   **Discrepancy Description:** DistrictWorkflow has no general email delivery table. Claims exist only for specific features, in `award_reminders` (`schema.ts:245-254`, status `claimed|sent|uncertain`) and `response_requests` (`schema.ts:208-219`).
*   **Rationale:** Name the table and columns that record invitation, reminder, thank-you and final-email claims. Reuse the `award_reminders` claim pattern.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** No general delivery table exists.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `survey_email_claims` with task ID, email kind and status `claimed`, `sent` or `uncertain`, following the `award_reminders` pattern.

### [Issue 21] codebase-2-15: No us-east-1 alert topic exists for `alert_topic_arn_us_east` [`egm-codebase-details` (also `egm-implementation-readiness`)] - Severity: Major
*   **Affected Scope:** Lines 879, 1509
*   **Discrepancy Description:** The only SNS topics are `digital_team_notifications` (`DistrictInfrastructure/monitoring.tf:1`) and the SES feedback topic. The existing us-east-1 CloudFront alarms have no `alarm_actions`. DistrictWorkflow's hosting design plans a new us-east-1 topic (`kubernetes-deployment.md:461-465`).
*   **Rationale:** In the `main.tf` row, either create the topic or reference the hosting plan's topic, and add it to the list of hosting plan requirements (841-852).
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** No `us-east-1` topic exists yet.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Reference the `us-east-1` alert topic planned in the DistrictWorkflow hosting design, and add it to the hosting plan requirements.

### [Issue 22] codebase-2-16: The secret setup order contradicts `secrets.tf` [`egm-codebase-details` (also `egm-implementation-readiness`)] - Severity: Major
*   **Affected Scope:** Lines 918-923, 1402, 1423
*   **Discrepancy Description:** In the setup steps, step 2 stores private keys in Secrets Manager and step 3 then runs `terraform apply`. But `secrets.tf` creates the "empty secret containers". So either the secrets do not exist when the script runs, or Terraform collides with secrets the script already created. The plan also does not say where the DistrictStatistics service tokens are generated and stored.
*   **Rationale:** Choose one order. Either apply first and then populate, or have the script create the secrets and Terraform read them as data sources. State exactly what `create-secrets.ts` writes.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The setup order contradicts `secrets.tf`.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Generate keys locally first, run `terraform apply` with the CloudFront public key so Terraform creates empty secret containers, then have `create-secrets.ts` write each value into its container and into 1Password. The script also generates the DistrictStatistics service tokens.

### [Issue 23] readiness-2-8: Phase 3's exit check depends on Phases 4 and 5 (round-1 readiness-1-1 leftover) [`egm-implementation-readiness` (also `egm-codebase-details`)] - Severity: Major
*   **Affected Scope:** Lines 576, 1245, 1368
*   **Discrepancy Description:** "One tracked response works on the test environment" (1245) needs build data from DistrictStatistics (`build-data.ts`, which calls an API that arrives in Phase 4). It also needs a tracked link signed by DistrictWorkflow and a completion-queue consumer, which arrive in Phase 5. No stand-in script is listed for either.
*   **Rationale:** Either have Phase 3 deploy with example data, and list a test-only link-signing script and queue reader, or move the end-to-end check to Phase 5.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Phase 3 cannot rely on Phases 4 and 5.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Phase 3 deploys with example build data and adds `scripts/sign-test-link.ts` and `scripts/read-test-queue.ts`, so a tracked response can be checked before DistrictWorkflow exists. The full end-to-end check moves to Phase 5.

### [Issue 24] style-2-1: "Comments without tasks" has no data to compute it from [`egm-style` (also `egm-codebase-details`; `egm-implementation-readiness` rated it Nit)] - Severity: Major
*   **Affected Scope:** Lines 687-690, 718, 1584, 1603
*   **Discrepancy Description:** `SurveyCommentsController` lists "comments without tasks", but `survey_comments` has no task column, and no route tells DistrictStatistics that a task was created. "Open comment text" (1584) is undefined.
*   **Rationale:** Add a `task_created_at` column and the call that sets it, or state that DistrictWorkflow removes duplicates against `survey_comment_tasks`. Define "open comment text".
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Nothing records which comments have tasks.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `task_created_at` to `survey_comments` and `PUT /api/v1/comments/{id}/task`, which DistrictWorkflow calls after creating a task. Define open comment text as text for comments with no decision.

### [Issue 25] style-2-2: The "Public code scope" section is referenced but missing (round-1 style-1-7, fix failed) [`egm-style` (also `egm-codebase-details`, `egm-implementation-readiness`)] - Severity: Major
*   **Affected Scope:** Lines 170, 1437, 1474, 1628, 1703. District values appear at 396, 848, 882 and 1233.
*   **Discrepancy Description:** G20 points to a "Public code scope" section that the document does not contain. `no-district-values.test.ts` scans "the checked paths", which are never listed, for terms held in an unnamed CI variable. This design document is itself public and contains the district domains and `LBDistrictScouts`, with no exemption stated. The runner label is not a repository variable.
*   **Rationale:** Add the section. List the scanned paths, the excluded paths (for example `docs/designs/**`), the CI variable that holds the terms, and the runner label variable. Refer to it from line 1474.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The referenced section is missing.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add a "Public code scope" section listing checked paths, excluded paths including `docs/**`, the `DISTRICT_TERMS` CI variable and the `SURVEY_RUNNER_LABEL` repository variable, and reference it from the test row.

### [Issue 26] style-2-3: Deploy triggers and the production source ref are ambiguous [`egm-style`] - Severity: Major
*   **Affected Scope:** Lines 879, 1178-1179, 1437, 1438
*   **Discrepancy Description:** Line 1437 lists `main`, `v*` tags and manual dispatch as triggers, but does not say what a tag push or a dispatch deploys, or which ref production is built from. `allowed_deploy_refs` has no value for either environment. `release.yml` also fires on `v*` tags, so one tag push starts two workflows and it is unclear which owns what.
*   **Rationale:** Add a table with one row per trigger, showing the workflow, the target environment, the GitHub environment and the `allowed_deploy_refs` value.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Each trigger needs one owner.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add a trigger table: `main` deploys to test, `v*` tags run `release.yml` and then production deploy after approval in the `production` environment, and manual dispatch can redeploy a tag. Give `allowed_deploy_refs` values for each environment.

### [Issue 27] style-2-4: The traceability gate and runner check claim more than the plan enforces [`egm-style` (also `egm-codebase-details`, `egm-implementation-readiness`)] - Severity: Major
*   **Affected Scope:** Lines 1403, 1595, 1614-1616, 1629, 1745
*   **Discrepancy Description:** Lines 1614-1616 fail every pull request when "a goal assigned to that repository" has no passing tagged test. The traceability table maps goals to suites, not to repositories. Only `district-survey` has a checker (1403). DistrictWorkflow has no CI row, although line 1629 runs its suite on every pull request and line 417 has its CI download contracts. The runner launch check (1745) passes when settings "are recorded", not when they hold the required values.
*   **Rationale:** Add a Repository column to the goal traceability table. Add a DistrictWorkflow CI row and a checker step in each repository, or limit line 1614 to `district-survey`. For runners, state the required values (runner group limited to `district-survey`, token scope, approval for outside contributors) and pass only when they match.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The gate claims more than the plan enforces. The owner is planning DistrictWorkflow CI separately.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add a Repository column to the goal traceability table. Run the checker in `district-survey` and DistrictStatistics, and list DistrictWorkflow's survey test job as a requirement for its separate CI plan. The runner check passes only when the settings match the required values.

### [Issue 28] readiness-2-9: Phase 1 scripts and workflows point at files from later phases [`egm-implementation-readiness` (also `egm-style`)] - Severity: Nit
*   **Affected Scope:** Lines 1280, 1436, 1438
*   **Discrepancy Description:** The Phase 1 `package.json` adds `test:e2e`, `test:stack`, `build:functions`, `secrets:create` and `dev:all`, whose files arrive in Phases 2-3. The Phase 1 `ci.yml` runs browser tests whose config arrives in Phase 3. The Phase 1 `release.yml` publishes bundles that do not exist until Phase 3.
*   **Rationale:** State which scripts and CI jobs each phase turns on, or move each one to the phase where its files exist.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Phase 1 refers to later files.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: State which scripts and CI jobs each phase turns on.

### [Issue 29] style-2-5: Phase 0 contradicts the hosting dependency table [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 845, 1242
*   **Discrepancy Description:** Phase 0 makes both test deployments a precondition for Phase 1. Line 845 says they are needed only for "Everything after Phase 3".
*   **Rationale:** Choose one and update the other.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The two statements disagree.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Phase 0 is needed before Phase 4. Phases 1 to 3 can start before hosting is ready.

### [Issue 30] readiness-2-10: The plan does not say how a test-send link avoids being counted [`egm-implementation-readiness`] - Severity: Nit
*   **Affected Scope:** Lines 438, 797, 1560
*   **Discrepancy Description:** The tracked-link payload carries only `v`, `s` and `u`. Nothing marks a test send.
*   **Rationale:** Say whether a test send uses a separate survey ID, a flag or a task that is thrown away.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Test sends need a defined marker.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Test sends use the separate pilot survey ID, so they never count.

### [Issue 31] readiness-2-11: Reviewer identity values and respondent error messages are undefined [`egm-implementation-readiness` (also `egm-style`, `egm-codebase-details`)] - Severity: Nit
*   **Affected Scope:** Lines 381, 601-603, 718, 720, 1384
*   **Discrepancy Description:** DistrictStatistics must never hold UUIDs, names or emails, yet it stores `decided_by` and `approved_by`, and the plan does not say what goes in them. The "fixed message and action" for each error code is not written anywhere, and line 1384 says only "fixed error responses".
*   **Rationale:** Define the value of `decided_by` and `approved_by`. Add the message text for each error code to `survey-api.v1.yaml`, and refer to it from line 1384.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** These values and messages need defining.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: `decided_by` and `approved_by` hold the DistrictWorkflow user ID only. Add each error code's message and action to `survey-api.v1.yaml`.

### [Issue 32] readiness-2-12: The CSP has no `style-src` [`egm-implementation-readiness` (also `egm-codebase-details`)] - Severity: Nit
*   **Affected Scope:** Line 891
*   **Discrepancy Description:** Without `style-src`, the policy falls back to `'self'`. Inline `style` attributes from Radix in AlignUI or from Turnstile would then be blocked (general knowledge, not tested).
*   **Rationale:** Confirm this in Phase 3, or add a style rule.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Radix and Turnstile may use inline styles.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `style-src 'self' 'unsafe-inline'` and confirm in Phase 3 whether it can be tightened.

### [Issue 33] codebase-2-17: The plan does not say what happens to the Datasets routes [`egm-codebase-details` (also `egm-implementation-readiness`)] - Severity: Nit
*   **Affected Scope:** Line 1577
*   **Discrepancy Description:** The existing Datasets CRUD in `DatasetsController.php` allows unauthenticated writes on the private host. Line 1577 mentions only "starter pages".
*   **Rationale:** State whether the Datasets routes are removed or protected.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The Datasets CRUD allows unauthenticated writes.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Remove the Datasets routes from production routing.

### [Issue 34] codebase-2-18: Existing assets to reuse are not cited [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** Infrastructure, deploy and DistrictWorkflow rows
*   **Discrepancy Description:** These existing assets could be reused:
  * `modules/cloudfront-distribution/clean-urls.js` (`main.tf:313-320`) already does the clean address rewrite.
  * `district-site/scripts/build-deployment.mjs:59-71` has `externalizeScripts`, but it hard-codes `/members/_inline/`, so the prefix would need to become configurable.
  * `district-site/.github/workflows/deploy.yml:324-325` shows the two-step sync.
  * DistrictWorkflow has `packages/persistence/src/testing/postgres.ts`, `commands/schedule-task-digest.ts` and `intake/activity-notification.ts`.
*   **Rationale:** Cite them in the relevant rows.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Reusing existing code saves work.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Cite `modules/cloudfront-distribution/clean-urls.js`, `externalizeScripts` with a configurable prefix, the two-step sync, and DistrictWorkflow's testing and intake helpers in their rows.

### [Issue 35] codebase-2-19: `district-site` is not a precedent for restricted runners [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** Lines 1143-1144
*   **Discrepancy Description:** `district-site` also runs its build job on `lbdistrictscouts-runners` for `pull_request` events (`deploy.yml:3-12, 35`).
*   **Rationale:** Remove "the same way as district-site", and do not copy its trigger.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** `district-site` builds pull requests on cluster runners.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Remove the comparison and keep the stricter trigger.

### [Issue 36] codebase-2-20: DistrictStatistics test coverage has gaps [`egm-codebase-details` (also `egm-style`)] - Severity: Nit
*   **Affected Scope:** Lines 1593, 1608, 1610
*   **Discrepancy Description:** The fixture row says "each table" but leaves out `SurveySettings`, `ImportBatches` and `CloseDownEvidence`. There are no tests for `CloseDownEvidenceController` or `SurveyArchiveRestoreCommand`. `HostHeaderTest.php` would conventionally sit at `tests/TestCase/Middleware/HostHeaderMiddlewareTest.php`.
*   **Rationale:** Add the fixtures and tests, and move the test file.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Some tables and commands have no tests.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add the missing fixtures and tests, and move the host test to `tests/TestCase/Middleware/HostHeaderMiddlewareTest.php`.

### [Issue 37] codebase-2-21: The `Application.php` row needs the exact middleware position [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** Line 1579
*   **Discrepancy Description:** "After routing" could mean before or after `BodyParserMiddleware` (`Application.php:87-98`).
*   **Rationale:** State the queue index, the CSRF `skipCheckCallback`, and the API base controller that renders JSON.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The position is ambiguous.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Place `ServiceApiMiddleware` immediately after `RoutingMiddleware` and before `BodyParserMiddleware`, use a CSRF `skipCheckCallback` for `/api/*`, and add an `Api/AppController` that renders JSON.

### [Issue 38] codebase-2-22: Worker script names are not given [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** Line 1543
*   **Discrepancy Description:** The existing convention is `<name>:schedule` and `<name>:consume` (`apps/worker/package.json:17-28`).
*   **Rationale:** Name the scripts.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Follow the existing naming.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Name the scripts `survey-completion:consume`, `survey-email-feedback:consume` and `survey-import:schedule`.

### [Issue 39] codebase-2-23: Survey emails should not use the status badge [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** Lines 1534, 1538
*   **Discrepancy Description:** `sendThemedEmail`'s `taskStatus` adds a remote PNG status badge (`reusable-activities.md:238-250`).
*   **Rationale:** State that survey emails do not use it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The badge loads a remote image.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: State that survey emails never use the status badge.

### [Issue 40] codebase-2-24: Some tools have no version or install step [`egm-codebase-details` (also `egm-implementation-readiness`)] - Severity: Nit
*   **Affected Scope:** Lines 896, 1250-1267, 1294
*   **Discrepancy Description:** None of oasdiff, actionlint, zizmor, k6, Trivy, TFLint or the OpenAPI mock tool has a version or an install step. The images for mock sign-in and local mail capture are not named. `@types/node ^20` does not match the Lambda runtime, which line 896 gives as "24 if supported, otherwise 22".
*   **Rationale:** Pin each tool and image, and fix the Lambda Node version.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Tools need versions.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Pin each tool and image in CI by version, and set `@types/node` to match the chosen Lambda runtime.

### [Issue 41] style-2-6: The migration row's table reference is ambiguous [`egm-style`] - Severity: Nit
*   **Affected Scope:** Line 1576
*   **Discrepancy Description:** "Creates the tables in 'DistrictStatistics'" points at a heading that is also the repository name.
*   **Rationale:** Name the nine tables, or link to the Technical Plan table.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The reference is ambiguous.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Name the nine tables in the migration row.

### [Issue 42] style-2-7: "Not checked" in the pull request behaviour table overstates the gap [`egm-style`] - Severity: Nit
*   **Affected Scope:** Line 1650
*   **Discrepancy Description:** Terraform tests check headers and limits in every pull request (1627).
*   **Rationale:** Write "Configuration only (Terraform tests). Runtime behaviour not checked."
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Terraform tests do check configuration.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Write "Configuration only, through Terraform tests. Runtime behaviour not checked."

### [Issue 43] style-2-8: Launch pass conditions lack measurement definitions [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 1733-1735, 1740
*   **Discrepancy Description:** These pass conditions cannot be measured as written:
  * "The expected peak" has no figure.
  * "Phone and 4G throttling" has no device profile or throttle values.
  * The 5-minute completion check has no start point.
  * The close-down drill cannot reach the Close + 3 months and Close + 12 months stages without a clock override, and the plan does not say whether one is used.
*   **Rationale:** Take the peak from a `load-test.js` parameter based on the audience-size question at line 214. Give the throttle values. Measure the 5-minute check from a successful submission, as G5 does. State whether the drill uses a clock override.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The conditions need measurement definitions.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Take the peak from a `load-test.js` parameter set from audience sizes, define the phone profile and throttle values, measure the 5-minute check from a successful submission, and run the close-down drill with a clock override in test.

### [Issue 44] style-2-9: The CUJ 10 test environment entry is ambiguous [`egm-style`] - Severity: Nit
*   **Affected Scope:** Line 1725
*   **Discrepancy Description:** "Scripted drill in docs/operations.md" names no script, and `tests/deployed` has no spam-removal drill.
*   **Rationale:** Add a script, or call it a manual check.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The entry names no script.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Add `tests/deployed/spam-removal-drill.sh`.

### [Issue 45] style-2-10: Some vague descriptions remain (round-1 style-1-9 leftover) [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 1436, 1553
*   **Discrepancy Description:** "Origin header check" is easy to confuse with the HTTP `Origin` header. "Checks" (1436) does not list the suites. "Matching existing workflow pages" (1553) names no page.
*   **Rationale:** Write "CloudFront secret origin header check", list the suites, and name the page being copied.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Some wording remains vague.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Write "CloudFront secret origin header check", list the CI suites, and name the Awards workflow pages as the pattern.

### [Issue 46] style-2-11: Survey workflows are unnamed [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 1535, 1563-1564, 1661
*   **Discrepancy Description:** Only `surveyImportWorkflow` and `surveyCloseDownWorkflow` are named, yet coverage needs "a replay test for every survey workflow".
*   **Rationale:** Name every survey workflow.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Replay coverage needs named workflows.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Name every survey workflow.

### [Issue 47] style-2-12: The yearly-reuse test claims more than a test can show [`egm-style`] - Severity: Nit
*   **Affected Scope:** Line 1451
*   **Discrepancy Description:** A test cannot show that "a new year needs no code change".
*   **Rationale:** Write "A second example survey file validates, builds and runs with no code change."
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** A test cannot show the general claim.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Write "A second example survey file validates, builds and runs with no code change."

### [Issue 48] style-2-13: Names collide or overlap between sections [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 92, 815, 1378, 1477, 1492, 1534, 1538, 1547, 1550
*   **Discrepancy Description:** `functions/tracking/open-link.ts` handles tracked links, but "open link" is the glossary term for the public link. Line 815 puts the close switches on the "survey settings page", and line 1550 puts them on the controls page. `email.ts` and `email-notifications/survey.ts` do not say how they divide the survey email work.
*   **Rationale:** Rename the file (for example to `open-tracked-link.ts`), choose one page, and state how the two email files divide the work.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Names collide.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: Rename `open-link.ts` to `open-tracked-link.ts`, put the close switches on the controls page only, and state that `email.ts` builds survey emails while `email-notifications/survey.ts` sends them.

### [Issue 49] style-2-14: Coverage scopes are not paths [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 1661, 1663
*   **Discrepancy Description:** "DistrictWorkflow survey code" and "Other DistrictStatistics survey code" cannot be configured as coverage filters.
*   **Rationale:** List the folders or glob patterns.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Coverage filters need paths.
*   ***Proposed Edit:***
    *   Location: The sections named in the change
    *   Change: List the folders for each coverage scope.
