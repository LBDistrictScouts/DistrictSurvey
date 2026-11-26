# Goldfish Review Report: Implementation Readiness, Round 2

**Target:** `/Users/jacob/Development/district-survey/docs/designs/district_survey.md` (lines 1229-1749, "Detailed Implementation Plan" to end of file, read with lines 1-1228 as context)

**Stage:** 9 (Implementation Readiness Test), round 2, re-audit after resolution

**Previous round:** `implementation_readiness_report.md` and `goldfish_review_report.md` in this folder

**Verdict:** Not ready to implement. The revision fixes most round-1 findings: it adds phases, shared contracts, signed-value formats, secrets, alarms, environments and traceability. But four Blockers remain. Each one either contradicts existing code or leaves open a decision that spans two repositories.

## Reviewer Status

| Reviewer | Status | Notes |
| --- | --- | --- |
| `egm-implementation-readiness` | completed | Checked all 41 round-1 findings; 10 Major and 5 Nit new findings |
| `egm-codebase-details` | completed | Checked all 41 round-1 findings against the permitted repository paths; 4 Blocker, 18 Major and 8 Nit new findings |
| `egm-style` | completed | Checked the 14 round-1 findings that concern wording; 8 Major and 15 Nit new findings |

No reviewer failed, so none was retried. Every reviewer stayed within the permitted paths. Points about AWS WAF, SES event destinations, CloudFront path mapping, Temporal retention and CSP behaviour rest on the reviewers' general knowledge. Nobody tested them. Nothing was built or run.

The owner's settled points were not reopened: the separate hosting plan, 12-hour batch archives, forwarded results links, small-group inference, decision Z3 option B, and the size of the test programme.

## Round-1 Findings: Does the Fix Hold?

Where reviewers disagreed, this table uses the less favourable rating and says so. A partly fixed finding is reported again as a new finding only where its remaining gap is large enough to block building. The "New finding" column links the two.

| Round-1 ID | Status | Evidence and remaining gap | New finding |
| --- | --- | --- | --- |
| style-1-1 | Fixed | Lines 327-340 record the replaced brief decisions, and `concepts_brief.md:20` says the design takes priority | - |
| style-1-2 | Fixed | Terraform rows say "Checks" (1483-1489), and `deployed-iam.spec.ts` was added (1494) | style-2-12 (one leftover overclaim at 1451) |
| style-1-3 | Fixed | Lines 1626, 1632 and 1441 add manual accessibility checks | - |
| style-1-4 | Fixed | A table for each critical user journey (CUJ) (1714-1727) | style-2-9 |
| style-1-5 | Fixed | Launch checks each have a script and a pass condition (1731-1745) | style-2-8 |
| style-1-6 | Partly fixed | Folders and setup are given (1670-1678), but `composer phpstan` has no script. Style rated this fixed with a leftover gap. | codebase-2-10 |
| style-1-7 | **Not fixed** | G20 (170) still points to a "Public code scope" section that does not exist. Line 1474 still scans undefined "checked paths". The runner label is not a repository variable (1437). All three reviewers agree. | style-2-2 |
| style-1-8 | Fixed | `s3-records.ts` is in the mutation scope (1291, 1623, 1658) | - |
| style-1-9 | Partly fixed | The listed phrases are gone. "Fixed error responses" (1384) and "matching existing workflow pages" (1553) remain. Readiness rated this fixed. | style-2-10 |
| style-1-10 | Fixed | The suite names match (1620-1632, 1682-1710) | - |
| style-1-11 | Fixed | Line 1583 | - |
| style-1-12 | Fixed | Declined in round 1, but the test rows are now grouped by folder (1446-1503) | - |
| readiness-1-1 | Partly fixed | Phases 0-6 have exit checks (1238-1248). Phase 3's exit check needs DistrictStatistics build data (Phase 4) and links signed by DistrictWorkflow (Phase 5). | readiness-2-8 |
| readiness-1-2 | Fixed | Open questions now have an owner, a deadline and a default (208-237). Settings live in DistrictStatistics (1234). | - |
| readiness-1-3 | Partly fixed | Signed values, the answer file, the comment file and the completion message are defined (405-484). Still undefined: the archive format, the comment and intake key layout, the import request body, results release fields, SSM parameter names, metric names, and most DistrictStatistics routes. | readiness-2-6 |
| readiness-1-4 | Partly fixed | Question types, panels, `replaces` and the fingerprint are defined (486-548). Missing: `scale` fields, how a panel is tied to a comment question, how a comment question is marked, how `audience` is worked out, exact setting keys (G20 branding and contact settings are absent), and which of `showInResults` and the "visible questions" setting wins | readiness-2-6 |
| readiness-1-5 | **Not fixed** | DistrictStatistics columns were added (710-720), but the DistrictWorkflow half is unresolved. The plan does not choose between the shared `tasks` table and survey-only tables, defines no columns, gives no status mapping and lists no seed rows. Readiness rated this partly fixed. Codebase rated it not fixed. | codebase-2-1 |
| readiness-1-6 | Partly fixed | Pool, reminders, overdue alarm and conflict handling were added (775-789). The comment-to-task marker and first pool notification do not work. Readiness rated this fixed. | style-2-1, codebase-2-4 |
| readiness-1-7 | Partly fixed | Switches, removal, restore and resend now have homes. No audit table exists for line 822, and no mechanism toggles the firewall. | codebase-2-1, codebase-2-7 |
| readiness-1-8 | Partly fixed | Sequence, evidence and drill were added (824-839, 1588, 1503). The plan does not say who deletes used records, keys and results data, or with what access. | readiness-2-7 |
| readiness-1-9 | Fixed | Lines 791-806 | readiness-2-3, readiness-2-10, codebase-2-13 |
| readiness-1-10 | Partly fixed | Thresholds and the missing-data rule are given (941-959). Metric names are missing, and the plan does not say who switches the import alarms on and off (958-959). Codebase rated this fixed. | readiness-2-6 |
| readiness-1-11 | Partly fixed | Ownership and the pinned source are given (871-883). Input types, several outputs and the source of `alert_topic_arn_us_east` are missing. | codebase-2-6, codebase-2-15 |
| readiness-1-12 | Partly fixed | Secrets table and key types added (900-925). The setup order contradicts `secrets.tf` (1423). | codebase-2-16 |
| readiness-1-13 | Fixed | Lines 384-403, 1404 | - |
| readiness-1-14 | Partly fixed | TypeScript dependencies are pinned (1250-1267). Still open: PHP packages, the DistrictWorkflow AWS SDK clients, and tool versions. | codebase-2-8, codebase-2-10, codebase-2-24 |
| readiness-1-15 | Fixed | Lines 1314-1316, 543-544, 415-417, 1565 | - |
| readiness-1-16 | Partly fixed | DistrictStatistics CI added (1595). No DistrictWorkflow CI row, the traceability checker exists only in `district-survey`, and `phpstan` has no script or config. | style-2-4, codebase-2-10 |
| readiness-1-17 | Partly fixed | The local stack is defined (1634-1651). The mock tool is unnamed, and the stack contradicts the Environments table. Codebase rated this fixed. | codebase-2-9 |
| readiness-1-18 | Fixed | Lines 885-898 | codebase-2-7, readiness-2-12 |
| readiness-1-19 | Partly fixed | The fixture folder is listed (1564). The plan gives no procedure for capturing and cleaning histories. Codebase rated this fixed. | - (add the capture procedure next to the `1564` row) |
| codebase-1-1 | Fixed | Hosting moved to the separate plan (settled). Lines 841-852 list its requirements. | codebase-2-3 |
| codebase-1-2 | Partly fixed | DistrictWorkflow is the only staff interface (758-773). No tag-check helper exists in `apps/web/src/lib`, and tag seed rows are missing. Readiness rated this fixed. | codebase-2-1, codebase-2-12 |
| codebase-1-3 | Fixed | Results are now protected data files (737-747, 1328) | codebase-2-5 |
| codebase-1-4 | Partly fixed | The publishing path is defined (563-576). Still open: how the compiled survey reaches the response Lambda (bundled at deploy, environment variable or S3), how `survey:validate` gets the previous survey for `replaces` (1243), and where the cluster runner's build token is stored | codebase-2-2 |
| codebase-1-5 | Partly fixed | Migration `0017` and its metadata are correct (1521-1523). DistrictWorkflow's root `yarn.lock`, `apps/web/package.json` and the extra SDK clients are not listed. | codebase-2-8, codebase-2-12 |
| codebase-1-6 | Fixed | Lines 848-849, 1608 | - |
| codebase-1-7 | Fixed | Lines 808-809, 933-939, 1562 | - |
| codebase-1-8 | Partly fixed | G10 accepts a rare duplicate (142), and the claim step is named (749). The "existing delivery records" cited at line 1538 do not exist. Readiness rated this fixed. | codebase-2-14 |
| codebase-1-9 | Partly fixed | The trigger and role trust are defined (1437, 1178-1179). The plan does not say which ref production deploys from, or what a `v*` tag push does. Style rated this partly fixed. The other two rated it fixed. | style-2-3 |
| codebase-1-10 | Fixed | Line 1579 matches `Application.php:68-98` | codebase-2-21 |

**Totals:** 19 fixed, 20 partly fixed, 2 not fixed (style-1-7 and readiness-1-5).

## Prioritized Findings (Blockers -> Major -> Nits)

### Blocker

#### codebase-2-1: DistrictWorkflow task model is undecided and contradicts the existing schema (round-1 readiness-1-5, fix failed) - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Lines 806, 822, 1520-1524, 1555, 1567
* **Discrepancy Description:** Line 1520 names `survey_invitations`, `survey_comment_tasks` and `survey_import_runs` but gives no columns, keys or indexes. The plan does not say whether survey tasks are rows in the shared `tasks` table. The design's statuses (`pending, sent, bounced, started, completed, declined, not_completed`, line 806) do not fit the existing enum `['pending','in_progress','completed']` (`DistrictWorkflow/packages/persistence/src/schema.ts:75`). Shared tasks need a published workflow, a definition, steps, a task type and a tag (`schema.ts:149-173`, `docs/workflow-data-model.md:46-60`). No seed migration creates these, or the `survey-admin`, `survey-reviewer` and `survey-analyst` tags. Line 1521 says the migration is generated with `db:generate`, which produces no seed rows. Existing workflows are seeded by hand-written SQL (`migrations/0014_workflow_cases.sql:36`). "Forward-only task status" (1524, 1567) has no defined order, and `bounced` and `declined` do not fit a single order. Line 822 needs an audit table that does not exist. Only `tasks.audit_notes` exists (`schema.ts:168`). The existing digest selects tasks by assigned user or tag membership (`task-digest-repository.ts:24-36`). A tag-assigned survey task could therefore show one volunteer's task to every tag member, which breaks the rule that named status is visible to `survey-admin` only (235).
* **Rationale & Recommendation:** Two builders would build incompatible schemas. Choose shared tasks or survey-only tables. Give a column table for each DistrictWorkflow table, matching the DistrictStatistics table at lines 710-720. List the allowed status transitions and how they map to the shared enum. Add a hand-written seed migration row and an audit table. State whether tasks are assigned by user or by tag. Add a test that no survey task appears in another user's digest.

#### codebase-2-2: The survey engine package has no name, build or distribution - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Lines 569, 1362, 1438, 1527, 1547
* **Discrepancy Description:** DistrictWorkflow's upload page validates with "the pinned survey engine package" (1527). `district-survey/package.json` is `"private": true`, has no `exports` and has no library build. `release.yml` (1438) publishes only Lambda bundles and the contracts release. The validator runs in `apps/web` (552, 569), but only `packages/integrations/package.json` is changed. `apps/web/package.json` and DistrictWorkflow's root `yarn.lock` are not listed.
* **Rationale & Recommendation:** CUJ 9 and Phase 5 depend on installing this package. Name the package, its build command and its output. State where it is published (GitHub Packages, a release tarball with a checksum, or inside the contracts release) and the versioning rule. List every DistrictWorkflow manifest and lockfile that changes.

#### codebase-2-3: The 14-day Temporal history promise conflicts with the hosting design and with how Temporal retention works - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 129-135 (G25), 237, 826-837, 847, 1209
* **Discrepancy Description:** DistrictWorkflow's hosting design sets 30-day retention for the shared `district-workflow` namespace and requires more than 14 days (`DistrictWorkflow/docs/designs/kubernetes-deployment.md:99, 233, 269-271`). The worker connects to a single namespace (`packages/integrations/src/temporal/config.ts:3`). Retention also starts only when a workflow closes. Invitation, reminder and close-down workflows run for months (836-837), so their histories outlive 14 days under any setting (general knowledge, not tested).
* **Rationale & Recommendation:** This does not reopen the settled hosting split. The design text itself makes a promise to respondents (G25) that the listed hosting requirements cannot keep. Either run survey workflows in a separate namespace with 14-day retention, and list the worker connection changes and the hosting requirement at 847, or reword G25 and line 237. Also make the long-running workflows close regularly, using short child runs or Continue-As-New.

#### codebase-2-4: Reviewer pool notification relies on a 72-hour digest that cannot meet the 48-hour review limit - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 779, 783-784, 1534, 1559
* **Discrepancy Description:** Line 779 relies on DistrictWorkflow's existing notification batching. That batching is `taskDigestWorkflow`, which runs every 72 hours and only for users with the `task-notification` preference (`DistrictWorkflow/docs/reusable-activities.md:256-277`, `apps/worker/src/commands/schedule-task-digest.ts:12-16`). The `email.ts` row lists "review emails", but no workflow step sends the first pool email.
* **Rationale & Recommendation:** Comment review within 48 hours (G16) is a safeguarding launch condition. Replace line 779 with an explicit pool email sent by the import workflow when it creates the task. State the recipients (every active `survey-reviewer` member) and how duplicate emails are prevented.

### Major

#### readiness-2-1: The grace period cannot work as specified - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 172-174 (G21), 443-444, 1391, 1459
* **Discrepancy Description:** G21 accepts submissions for 1 hour after close if the person started before the deadline. Tracked passes expire at close (444), so every tracked submission in the grace hour fails. For open-link submissions, the server records no trusted start time.
* **Rationale & Recommendation:** Choose a rule. For example, set the pass `exp` to close + 1 hour, and either accept any open submission in that hour or issue a signed start value. Record the rule in `signed-values.v1.json` and test it in `survey-window.test.ts`.

#### readiness-2-2: Spam comments cannot be removed by source - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also `egm-codebase-details`)
* **Affected Scope:** Lines 461-476, 718, 817, 973, 1587, 1606
* **Discrepancy Description:** Spam removal selects "by date and source" and marks matching responses and comments. Comment files and `survey_comments` have no `source` field, and comments carry no submission ID. Removing open-link spam would therefore remove tracked comments too, or no comments at all.
* **Rationale & Recommendation:** Add `source` to the comment file schema and the table, or state that comments are removed by date only or reviewed by hand.

#### readiness-2-3: Declining has no route, event or screen - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 484, 591-599, 803, 806, 1560
* **Discrepancy Description:** Line 803 says a person can decline from their link, and `declined` is a task status. No tracking route accepts a decline, the completion message `event` allows only `started` or `completed`, and no page or component offers the choice.
* **Rationale & Recommendation:** Add a decline route (for example `POST /api/v1/tracking/decline`), a `declined` event in the completion message schema, the component and its tests. Otherwise remove decline from the design.

#### readiness-2-4: Wording fixes clash with the unique fingerprint, and nothing freezes the fingerprint - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 546-548, 571-574, 713, 1581
* **Discrepancy Description:** Wording fixes are left out of the fingerprint so that drafts survive. But `survey_versions` requires the fingerprint to be unique within a survey, so an approved wording fix after opening cannot be stored as a new version. Nothing names what freezes the fingerprint "when the survey opens": no workflow step, API check or schedule.
* **Rationale & Recommendation:** Apply uniqueness to a content hash or a version number. Name the component that freezes the fingerprint, and test it.

#### codebase-2-5: Results bucket keys do not match the results URL - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Lines 733-735, 742, 1308, 1328, 1393, 1416, 1591
* **Discrepancy Description:** The publisher writes `results/{surveyId}/...`, but the page requests `/results-data/{surveyId}/current.json`. CloudFront passes the path to S3 unchanged, and an origin path can only add a prefix. No rewrite function is listed, and `clean-urls.js` handles page addresses only. The contracts do not say whether `current.json` is a copy of the release or a pointer to it. If it is a pointer, the page makes two requests.
* **Rationale & Recommendation:** `cloudfront.tf`, `SurveyResultsPublisher.php` and `results-proxy.ts` sit in different repositories and phases. Use one key prefix, for example `results-data/`, or add a named rewrite function. Define `current.json` in `results-release.v1.json`.

#### codebase-2-6: Module inputs, outputs and IAM actions are incomplete - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`)
* **Affected Scope:** Lines 830-837, 868, 879, 1174-1177, 1427, 1486, 1510
* **Discrepancy Description:** Module inputs have no types. DistrictWorkflow needs several values that are not outputs: the feedback queue URL, the SES configuration set name, the used-records bucket, the SSM parameter names, the secret ARNs and the WAF ACL. `route53_zone_id` needs a root lookup, and existing modules look zones up by name (`modules/certificates/main.tf:1-3`). `iam.tftest.hcl` checks "only its listed actions and resources", but no list exists. Close-down, results publishing, archive reading and metric publishing each need actions that nothing names. The `output.tf` row (1510) does not say which outputs it exposes.
* **Rationale & Recommendation:** List every input with its type and every output. Add a table of actions and resource ARNs for each role and policy, so the IAM test has something to check against.

#### codebase-2-7: The firewall attachment point and the open-route toggle are undefined - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`)
* **Affected Scope:** Lines 815, 862, 867, 1426, 1532
* **Discrepancy Description:** AWS WAF cannot be attached to an API Gateway HTTP API (general knowledge, not tested). The open-route rule would need to sit on the CloudFront web ACL in us-east-1, scoped to `/api/v1/responses/open`. Line 815 says closing the open route turns on its firewall block, but DistrictWorkflow's `controls.ts` only updates SSM, and no WAF permission or client is listed.
* **Rationale & Recommendation:** State the WAF scope and provider alias, how the rule is switched on and off, and which role is allowed to switch it.

#### readiness-2-6: Contracts shared between repositories are still missing (round-1 readiness-1-3 and readiness-1-4 leftovers) - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also `egm-codebase-details`)
* **Affected Scope:** Lines 405-430, 499, 634, 680-682, 958-959, 1308, 1345, 1390, 1428, 1530-1533, 1581-1592
* **Discrepancy Description:** These are not defined, although two repositories must agree on each:
  * The archive format, compression, key and checksum. DistrictWorkflow (TypeScript) writes the archive and `SurveyArchiveRestoreCommand.php` reads it.
  * The comment file prefix and the full intake key layout. Only `intake/answers/{fileKey}` is given.
  * The import request body, and how `batchId` is created.
  * The fields of the results release, including hidden groups, which `ResultsList.tsx` renders.
  * The names and value formats of the SSM control parameters. DistrictWorkflow's `controls.ts` writes them and the Lambda's `controls.ts` reads them.
  * The CloudWatch namespace and metric names. DistrictWorkflow's `metrics.ts` publishes them and `alarms.tf` watches them.
  * Who switches the import alarms on and off, and how.
  * Most DistrictStatistics API routes (versions, comments, releases, dashboard, removals, evidence), with method, token scope and status codes.
  * The survey format leftovers listed under readiness-1-4 in the status table.
* **Rationale & Recommendation:** Add each of these to "Shared contracts" with its own schema file, and add the routes to `statistics-api`.

#### readiness-2-7: Who deletes what at close-down is undefined - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 835-837, 1530, 1535
* **Discrepancy Description:** Close-down deletes used-link and receipt records, destroys HMAC and Ed25519 keys, and removes results data at close + 3 months. In DistrictWorkflow, `storage.ts` covers intake files only and `controls.ts` covers SSM only. No file owns these deletions, and no client or permission allows them.
* **Rationale & Recommendation:** Name the activity file for each deletion, the AWS client it uses, and the IAM action it needs (see codebase-2-6).

#### codebase-2-8: DistrictWorkflow AWS SDK packages are missing - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`)
* **Affected Scope:** Lines 1386, 1527, 1532-1533
* **Discrepancy Description:** Only `@aws-sdk/client-s3` is added. `controls.ts` needs SSM, `metrics.ts` needs CloudWatch, key destruction needs Secrets Manager, and a firewall toggle would need WAFv2. The worker declares only `client-sesv2` and `client-sqs` (`apps/worker/package.json:30-32`). In `district-survey`, `functions/shared/metrics.ts` needs either a CloudWatch client or a statement that it uses Embedded Metric Format, which `logger.ts` would then have to allow.
* **Rationale & Recommendation:** List each package with its version and the workspace that declares it.

#### codebase-2-9: The local and pull request stack contradicts the Environments table and existing DistrictWorkflow setup - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-style`, `egm-implementation-readiness`)
* **Affected Scope:** Lines 392-401, 1294, 1634-1651
* **Discrepancy Description:** Line 392 runs DistrictWorkflow and DistrictStatistics as local containers, but line 1643 uses mock services generated from OpenAPI files. DistrictWorkflow has no OpenAPI file (429-430). The mock tool is unnamed (readiness-1-17). No row says which repository's compose file runs the real containers. "DistrictWorkflow tasks and emails: Mocked" (1651) does not say what the mock is. DistrictWorkflow checks sign-in tokens against a hard-coded Cognito issuer (`apps/web/src/lib/cognito.ts:16-18, 27, 33`), so a "mock sign-in service" needs a DistrictWorkflow change that is not listed. DistrictWorkflow already starts Moto on port 4566 (`docs/training-fund.md:270-275`), so a second Moto in `docker-compose.yml` would clash. Moto already captures SES mail, and a real dev Cognito client with a localhost callback already exists (`DistrictInfrastructure/modules/workflow/README.md:33-39`).
* **Rationale & Recommendation:** Split the section into "Local development" and "Pull request stack". For each service, say whether it is a real container (and from which compose file) or a named mock. Reuse DistrictWorkflow's Moto and dev Cognito client, or list the DistrictWorkflow changes that make the issuer configurable. Name and pin the mock tool.

#### codebase-2-10: PHP tooling commands and packages are not defined - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Lines 1269-1270, 1575, 1663, 1672-1676
* **Discrepancy Description:** `composer phpstan` (1675) does not exist. `DistrictStatistics/data-core/composer.json:46-56` defines only `check`, `cs-check`, `cs-fix` and `test`. No `phpstan.neon` row sets level 8 (1663). "An OpenAPI request validator" and the PHP JSON Schema validator have no package names or versions. "Sign in to the test AWS account" names no profile or role. Style also flagged `yarn typecheck` and `yarn lint`, but both already exist in `district-survey/package.json`, so that part is not a gap.
* **Rationale & Recommendation:** Add the Composer script and the PHPStan config row, name each Composer package with its version constraint, and name the AWS profile or role.

#### codebase-2-11: The DistrictStatistics CI file path is ambiguous, and the file includes deployment work - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Lines 1569, 1571, 1595
* **Discrepancy Description:** The table is headed `data-core/`, so `.github/workflows/ci.yml` would resolve to `data-core/.github/...`. GitHub reads workflows only from the repository root. Line 1571 says deployment files belong to the hosting plan, but the `ci.yml` row includes image build, publishing to GHCR and a protected release. These need a Dockerfile, which the hosting plan owns.
* **Rationale & Recommendation:** Give the path from the repository root with `working-directory: data-core`. Either remove the deployment steps or state the boundary with the hosting plan and name the Dockerfile dependency.

#### codebase-2-12: The DistrictWorkflow web file list omits required integration points - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 763-770, 1545-1555
* **Discrepancy Description:** The task modal dispatches on `task.kind` from `lib/task-reference.ts:1-18` (`components/tasks/task-modal.tsx:6-9, 60`). `survey-comment-review.tsx` cannot open unless both files change. `app/workflows/page.tsx:12` hard-codes the workflow cards. `workflowCaseSummary` uses `workflowOverviewRepository().caseSummary(slug)` (`workflow-overview-repository.ts:8-22`). No helper exists for tag-based page access: `workflow-tasks.ts:11-14` checks only that a user is signed in. `apps/web/package.json` and the root `yarn.lock` are not listed.
* **Rationale & Recommendation:** Add rows for these files and for a new tag-check helper, with a test.

#### codebase-2-13: The survey's SES configuration set cannot be used through the shared sender - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 800, 1425, 1534, 1541
* **Discrepancy Description:** `deliverThemedEmail` builds `SendEmail` without `ConfigurationSetName` (`packages/integrations/src/email/ses.ts:20-35`), and `ses.ts` is not in the file list. DistrictWorkflow's sending identities already route bounces to the shared queue (`DistrictInfrastructure/modules/transactional-email/feedback.tf:1-6`), so survey bounces would arrive twice. The shared feedback SNS topic accepts only SES identity source ARNs (`feedback/main.tf:20-22`). SES event destinations cannot target SQS directly (general knowledge, not tested).
* **Rationale & Recommendation:** Add the `ses.ts` change. In `email.tf`, specify the SNS topic, its policy and the subscription. State how the shared-queue consumer ignores survey bounces.

#### codebase-2-14: The "existing delivery records" cited for email claims do not exist - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 1538
* **Discrepancy Description:** DistrictWorkflow has no general email delivery table. Claims exist only for specific features, in `award_reminders` (`schema.ts:245-254`, status `claimed|sent|uncertain`) and `response_requests` (`schema.ts:208-219`).
* **Rationale & Recommendation:** Name the table and columns that record invitation, reminder, thank-you and final-email claims. Reuse the `award_reminders` claim pattern.

#### codebase-2-15: No us-east-1 alert topic exists for `alert_topic_arn_us_east` - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`)
* **Affected Scope:** Lines 879, 1509
* **Discrepancy Description:** The only SNS topics are `digital_team_notifications` (`DistrictInfrastructure/monitoring.tf:1`) and the SES feedback topic. The existing us-east-1 CloudFront alarms have no `alarm_actions`. DistrictWorkflow's hosting design plans a new us-east-1 topic (`kubernetes-deployment.md:461-465`).
* **Rationale & Recommendation:** In the `main.tf` row, either create the topic or reference the hosting plan's topic, and add it to the list of hosting plan requirements (841-852).

#### codebase-2-16: The secret setup order contradicts `secrets.tf` - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`)
* **Affected Scope:** Lines 918-923, 1402, 1423
* **Discrepancy Description:** In the setup steps, step 2 stores private keys in Secrets Manager and step 3 then runs `terraform apply`. But `secrets.tf` creates the "empty secret containers". So either the secrets do not exist when the script runs, or Terraform collides with secrets the script already created. The plan also does not say where the DistrictStatistics service tokens are generated and stored.
* **Rationale & Recommendation:** Choose one order. Either apply first and then populate, or have the script create the secrets and Terraform read them as data sources. State exactly what `create-secrets.ts` writes.

#### readiness-2-8: Phase 3's exit check depends on Phases 4 and 5 (round-1 readiness-1-1 leftover) - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also `egm-codebase-details`)
* **Affected Scope:** Lines 576, 1245, 1368
* **Discrepancy Description:** "One tracked response works on the test environment" (1245) needs build data from DistrictStatistics (`build-data.ts`, which calls an API that arrives in Phase 4). It also needs a tracked link signed by DistrictWorkflow and a completion-queue consumer, which arrive in Phase 5. No stand-in script is listed for either.
* **Rationale & Recommendation:** Either have Phase 3 deploy with example data, and list a test-only link-signing script and queue reader, or move the end-to-end check to Phase 5.

#### style-2-1: "Comments without tasks" has no data to compute it from - Severity: Major
* **Reviewer Lens:** `egm-style` (also `egm-codebase-details`; `egm-implementation-readiness` rated it Nit)
* **Affected Scope:** Lines 687-690, 718, 1584, 1603
* **Discrepancy Description:** `SurveyCommentsController` lists "comments without tasks", but `survey_comments` has no task column, and no route tells DistrictStatistics that a task was created. "Open comment text" (1584) is undefined.
* **Rationale & Recommendation:** Add a `task_created_at` column and the call that sets it, or state that DistrictWorkflow removes duplicates against `survey_comment_tasks`. Define "open comment text".

#### style-2-2: The "Public code scope" section is referenced but missing (round-1 style-1-7, fix failed) - Severity: Major
* **Reviewer Lens:** `egm-style` (also `egm-codebase-details`, `egm-implementation-readiness`)
* **Affected Scope:** Lines 170, 1437, 1474, 1628, 1703. District values appear at 396, 848, 882 and 1233.
* **Discrepancy Description:** G20 points to a "Public code scope" section that the document does not contain. `no-district-values.test.ts` scans "the checked paths", which are never listed, for terms held in an unnamed CI variable. This design document is itself public and contains the district domains and `LBDistrictScouts`, with no exemption stated. The runner label is not a repository variable.
* **Rationale & Recommendation:** Add the section. List the scanned paths, the excluded paths (for example `docs/designs/**`), the CI variable that holds the terms, and the runner label variable. Refer to it from line 1474.

#### style-2-3: Deploy triggers and the production source ref are ambiguous - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 879, 1178-1179, 1437, 1438
* **Discrepancy Description:** Line 1437 lists `main`, `v*` tags and manual dispatch as triggers, but does not say what a tag push or a dispatch deploys, or which ref production is built from. `allowed_deploy_refs` has no value for either environment. `release.yml` also fires on `v*` tags, so one tag push starts two workflows and it is unclear which owns what.
* **Rationale & Recommendation:** Add a table with one row per trigger, showing the workflow, the target environment, the GitHub environment and the `allowed_deploy_refs` value.

#### style-2-4: The traceability gate and runner check claim more than the plan enforces - Severity: Major
* **Reviewer Lens:** `egm-style` (also `egm-codebase-details`, `egm-implementation-readiness`)
* **Affected Scope:** Lines 1403, 1595, 1614-1616, 1629, 1745
* **Discrepancy Description:** Lines 1614-1616 fail every pull request when "a goal assigned to that repository" has no passing tagged test. The traceability table maps goals to suites, not to repositories. Only `district-survey` has a checker (1403). DistrictWorkflow has no CI row, although line 1629 runs its suite on every pull request and line 417 has its CI download contracts. The runner launch check (1745) passes when settings "are recorded", not when they hold the required values.
* **Rationale & Recommendation:** Add a Repository column to the goal traceability table. Add a DistrictWorkflow CI row and a checker step in each repository, or limit line 1614 to `district-survey`. For runners, state the required values (runner group limited to `district-survey`, token scope, approval for outside contributors) and pass only when they match.

### Nit

#### readiness-2-9: Phase 1 scripts and workflows point at files from later phases - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness` (also `egm-style`)
* **Affected Scope:** Lines 1280, 1436, 1438
* **Discrepancy Description:** The Phase 1 `package.json` adds `test:e2e`, `test:stack`, `build:functions`, `secrets:create` and `dev:all`, whose files arrive in Phases 2-3. The Phase 1 `ci.yml` runs browser tests whose config arrives in Phase 3. The Phase 1 `release.yml` publishes bundles that do not exist until Phase 3.
* **Rationale & Recommendation:** State which scripts and CI jobs each phase turns on, or move each one to the phase where its files exist.

#### style-2-5: Phase 0 contradicts the hosting dependency table - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 845, 1242
* **Discrepancy Description:** Phase 0 makes both test deployments a precondition for Phase 1. Line 845 says they are needed only for "Everything after Phase 3".
* **Rationale & Recommendation:** Choose one and update the other.

#### readiness-2-10: The plan does not say how a test-send link avoids being counted - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 438, 797, 1560
* **Discrepancy Description:** The tracked-link payload carries only `v`, `s` and `u`. Nothing marks a test send.
* **Rationale & Recommendation:** Say whether a test send uses a separate survey ID, a flag or a task that is thrown away.

#### readiness-2-11: Reviewer identity values and respondent error messages are undefined - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness` (also `egm-style`, `egm-codebase-details`)
* **Affected Scope:** Lines 381, 601-603, 718, 720, 1384
* **Discrepancy Description:** DistrictStatistics must never hold UUIDs, names or emails, yet it stores `decided_by` and `approved_by`, and the plan does not say what goes in them. The "fixed message and action" for each error code is not written anywhere, and line 1384 says only "fixed error responses".
* **Rationale & Recommendation:** Define the value of `decided_by` and `approved_by`. Add the message text for each error code to `survey-api.v1.yaml`, and refer to it from line 1384.

#### readiness-2-12: The CSP has no `style-src` - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness` (also `egm-codebase-details`)
* **Affected Scope:** Line 891
* **Discrepancy Description:** Without `style-src`, the policy falls back to `'self'`. Inline `style` attributes from Radix in AlignUI or from Turnstile would then be blocked (general knowledge, not tested).
* **Rationale & Recommendation:** Confirm this in Phase 3, or add a style rule.

#### codebase-2-17: The plan does not say what happens to the Datasets routes - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`)
* **Affected Scope:** Line 1577
* **Discrepancy Description:** The existing Datasets CRUD in `DatasetsController.php` allows unauthenticated writes on the private host. Line 1577 mentions only "starter pages".
* **Rationale & Recommendation:** State whether the Datasets routes are removed or protected.

#### codebase-2-18: Existing assets to reuse are not cited - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Infrastructure, deploy and DistrictWorkflow rows
* **Discrepancy Description:** These existing assets could be reused:
  * `modules/cloudfront-distribution/clean-urls.js` (`main.tf:313-320`) already does the clean address rewrite.
  * `district-site/scripts/build-deployment.mjs:59-71` has `externalizeScripts`, but it hard-codes `/members/_inline/`, so the prefix would need to become configurable.
  * `district-site/.github/workflows/deploy.yml:324-325` shows the two-step sync.
  * DistrictWorkflow has `packages/persistence/src/testing/postgres.ts`, `commands/schedule-task-digest.ts` and `intake/activity-notification.ts`.
* **Rationale & Recommendation:** Cite them in the relevant rows.

#### codebase-2-19: `district-site` is not a precedent for restricted runners - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 1143-1144
* **Discrepancy Description:** `district-site` also runs its build job on `lbdistrictscouts-runners` for `pull_request` events (`deploy.yml:3-12, 35`).
* **Rationale & Recommendation:** Remove "the same way as district-site", and do not copy its trigger.

#### codebase-2-20: DistrictStatistics test coverage has gaps - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details` (also `egm-style`)
* **Affected Scope:** Lines 1593, 1608, 1610
* **Discrepancy Description:** The fixture row says "each table" but leaves out `SurveySettings`, `ImportBatches` and `CloseDownEvidence`. There are no tests for `CloseDownEvidenceController` or `SurveyArchiveRestoreCommand`. `HostHeaderTest.php` would conventionally sit at `tests/TestCase/Middleware/HostHeaderMiddlewareTest.php`.
* **Rationale & Recommendation:** Add the fixtures and tests, and move the test file.

#### codebase-2-21: The `Application.php` row needs the exact middleware position - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 1579
* **Discrepancy Description:** "After routing" could mean before or after `BodyParserMiddleware` (`Application.php:87-98`).
* **Rationale & Recommendation:** State the queue index, the CSRF `skipCheckCallback`, and the API base controller that renders JSON.

#### codebase-2-22: Worker script names are not given - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 1543
* **Discrepancy Description:** The existing convention is `<name>:schedule` and `<name>:consume` (`apps/worker/package.json:17-28`).
* **Rationale & Recommendation:** Name the scripts.

#### codebase-2-23: Survey emails should not use the status badge - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 1534, 1538
* **Discrepancy Description:** `sendThemedEmail`'s `taskStatus` adds a remote PNG status badge (`reusable-activities.md:238-250`).
* **Rationale & Recommendation:** State that survey emails do not use it.

#### codebase-2-24: Some tools have no version or install step - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details` (also `egm-implementation-readiness`)
* **Affected Scope:** Lines 896, 1250-1267, 1294
* **Discrepancy Description:** None of oasdiff, actionlint, zizmor, k6, Trivy, TFLint or the OpenAPI mock tool has a version or an install step. The images for mock sign-in and local mail capture are not named. `@types/node ^20` does not match the Lambda runtime, which line 896 gives as "24 if supported, otherwise 22".
* **Rationale & Recommendation:** Pin each tool and image, and fix the Lambda Node version.

#### style-2-6: The migration row's table reference is ambiguous - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 1576
* **Discrepancy Description:** "Creates the tables in 'DistrictStatistics'" points at a heading that is also the repository name.
* **Rationale & Recommendation:** Name the nine tables, or link to the Technical Plan table.

#### style-2-7: "Not checked" in the pull request behaviour table overstates the gap - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 1650
* **Discrepancy Description:** Terraform tests check headers and limits in every pull request (1627).
* **Rationale & Recommendation:** Write "Configuration only (Terraform tests). Runtime behaviour not checked."

#### style-2-8: Launch pass conditions lack measurement definitions - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1733-1735, 1740
* **Discrepancy Description:** These pass conditions cannot be measured as written:
  * "The expected peak" has no figure.
  * "Phone and 4G throttling" has no device profile or throttle values.
  * The 5-minute completion check has no start point.
  * The close-down drill cannot reach the Close + 3 months and Close + 12 months stages without a clock override, and the plan does not say whether one is used.
* **Rationale & Recommendation:** Take the peak from a `load-test.js` parameter based on the audience-size question at line 214. Give the throttle values. Measure the 5-minute check from a successful submission, as G5 does. State whether the drill uses a clock override.

#### style-2-9: The CUJ 10 test environment entry is ambiguous - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 1725
* **Discrepancy Description:** "Scripted drill in docs/operations.md" names no script, and `tests/deployed` has no spam-removal drill.
* **Rationale & Recommendation:** Add a script, or call it a manual check.

#### style-2-10: Some vague descriptions remain (round-1 style-1-9 leftover) - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1436, 1553
* **Discrepancy Description:** "Origin header check" is easy to confuse with the HTTP `Origin` header. "Checks" (1436) does not list the suites. "Matching existing workflow pages" (1553) names no page.
* **Rationale & Recommendation:** Write "CloudFront secret origin header check", list the suites, and name the page being copied.

#### style-2-11: Survey workflows are unnamed - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1535, 1563-1564, 1661
* **Discrepancy Description:** Only `surveyImportWorkflow` and `surveyCloseDownWorkflow` are named, yet coverage needs "a replay test for every survey workflow".
* **Rationale & Recommendation:** Name every survey workflow.

#### style-2-12: The yearly-reuse test claims more than a test can show - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 1451
* **Discrepancy Description:** A test cannot show that "a new year needs no code change".
* **Rationale & Recommendation:** Write "A second example survey file validates, builds and runs with no code change."

#### style-2-13: Names collide or overlap between sections - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 92, 815, 1378, 1477, 1492, 1534, 1538, 1547, 1550
* **Discrepancy Description:** `functions/tracking/open-link.ts` handles tracked links, but "open link" is the glossary term for the public link. Line 815 puts the close switches on the "survey settings page", and line 1550 puts them on the controls page. `email.ts` and `email-notifications/survey.ts` do not say how they divide the survey email work.
* **Rationale & Recommendation:** Rename the file (for example to `open-tracked-link.ts`), choose one page, and state how the two email files divide the work.

#### style-2-14: Coverage scopes are not paths - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1661, 1663
* **Discrepancy Description:** "DistrictWorkflow survey code" and "Other DistrictStatistics survey code" cannot be configured as coverage filters.
* **Rationale & Recommendation:** List the folders or glob patterns.

## Summary

| Severity | Count |
| --- | --- |
| Blocker | 4 |
| Major | 24 |
| Nit | 22 |

Round-1 findings: 19 fixed, 20 partly fixed, 2 not fixed.
