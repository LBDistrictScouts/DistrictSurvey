# Goldfish Review Report: Stage 9 Implementation Readiness Test, Round 1

**Target:** `/Users/jacob/Development/district-survey/docs/designs/district_survey.md` (lines 994-1441, "Detailed Implementation Plan" to the end of the file)

**Standard:** `/Users/jacob/.claude/plugins/cache/egm/egm/0.1.1/resources/document_standards/implementation-readiness-standard.md` (implementation readiness and codebase details lenses; the style lens has no standard)

## Reviewer Status

| Reviewer | Status | Raw findings returned |
| --- | --- | --- |
| `egm-implementation-readiness` | completed | 10 Blocker, 14 Major, 6 Nit |
| `egm-codebase-details` | completed | 7 Blocker, 19 Major, 2 Nit |
| `egm-style` | completed | 1 Blocker, 19 Major, 4 Nit |

No reviewer needed a retry.

**Consolidated findings:** 11 Blocker, 23 Major, 7 Nit (41 in total, from 82 raw findings).

## Verdict

**The plan is not ready to implement.** It lists the files to create, but an engineer would still have to make design decisions in these areas:

* the order of the work
* the formats shared between repositories
* the database tables
* how the two applications are hosted
* staff sign-in
* comment review
* the results build

One finding, `style-1-1`, needs the owner's answer first, because the plan differs from recorded owner decisions.

## How to Read This Report

* Finding IDs use the form `<reviewer>-1-<n>`, where the reviewer is `readiness`, `codebase` or `style`. The reviewer named in the ID is the main source. Other reviewers that raised the same point are listed under **Reviewer Lens**.
* **Affected Scope** gives lines in the target document. Lines before 994 are cited only as context.
* Repository paths in evidence are relative to `/Users/jacob/Development/`.
* Z1 to Z4 are unresolved proposals in `intermediate_zoom_out_report.md`. Every finding here describes the plan as written, and none assumes those proposals are accepted.

## Owner Decisions

| Finding | Decision | What the owner needs to do |
| --- | --- | --- |
| `style-1-1` | **Reopens decisions 9 and 9c, and decision 7 in part** (`concepts_brief.md:402, 404, 407`) | Approve the plan's approach and record that approval, or bring the plan back into line with the decisions. |
| `readiness-1-2` | Reopens no recorded decision | Answer the open questions that change the code (`concepts_brief.md:411-424`, target lines 186-219). |
| `codebase-1-3`, `codebase-1-4` | Reopen a decision only if Z4 is accepted | Z4 would reopen G24, the design choice at line 417 and possibly decision 8. |
| `codebase-1-9` | Reopens a decision only if Z4 is accepted | Decision 8 reopens if the deploy pipeline moves to a private repository. |

The readiness reviewer reported that no recorded decision is reopened. The style and codebase reviewers disagreed. The consolidated position follows the wording of the decisions, as explained in `style-1-1`.

## Dependencies on Unresolved Proposals

| Proposal | Findings affected |
| --- | --- |
| Z1: launch gate and split scope for DistrictStatistics | `readiness-1-1`, `readiness-1-6`, `codebase-1-1`, `codebase-1-2` |
| Z2: one link record and no receipts in the tracked flow | `readiness-1-3` |
| Z3: DistrictStatistics collects answers once a day | `readiness-1-3`, `readiness-1-5`, `readiness-1-6`, `readiness-1-7`, `readiness-1-10`, `codebase-1-5`, `codebase-1-7` |
| Z4: stop building the site and results on the cluster | `style-1-1`, `style-1-7`, `codebase-1-3`, `codebase-1-4`, `codebase-1-5`, `codebase-1-6`, `codebase-1-9` |

Settle Z1 to Z4 before rewriting the sections these findings affect. Otherwise some of that work may need to be redone.

## Prioritized Findings (Blockers -> Major -> Nits)

## Blockers

### style-1-1. The plan differs from recorded owner decisions without saying so - Severity: Blocker
* **Reviewer Lens:** `egm-style`, `egm-codebase-details`
* **Affected Scope:** Lines 1046-1047, 1098-1103, 1111, 1135, 1163
* **Problem:** Decision 9 says the submit Lambda sends the UUID to the queue. The plan has a separate tracking Lambda do this, and the response Lambda never accepts a UUID (lines 1098, 1102). Decision 9c says results are held in a private bucket and "served only through that API". The plan instead publishes built results pages to the site bucket and protects them with CloudFront signed cookies (lines 1046, 1111, 1163, and line 623). Decision 7 keeps results in a separate private bucket, which the plan does only for the release data (line 1135).
* **Rationale & Recommendation:** The brief says its decisions apply where other text differs (`concepts_brief.md:20`), so a builder cannot tell which source to follow. The design records signed cookies as the author's choice (lines 854, 862), but the brief records no owner approval of the change. Record the owner's approval and update the brief, or change the plan to match the decisions.
* **Owner decision:** **Reopens decisions 9 and 9c, and decision 7 in part.**
* **Depends on:** Z4 would change the results path again.

### readiness-1-1. The delivery order cannot be followed - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 1005-1012, 1092, 1220, 1311-1328, 1349, 1436-1437
* **Problem:** Step 2 needs a test deployment, but the Terraform arrives in step 3. Step 4 builds an import against a DistrictStatistics API that arrives in step 5, and real site builds need that API too. The 14 Homelab rows belong to no step. File rows are not assigned to steps, and no step has an exit check. Step 2 also leaves out the signed link and queue proof that stage 1 of the brief requires (`concepts_brief.md:431`).
* **Rationale & Recommendation:** The standard requires each phase to leave the code buildable and testable. Reorder the steps, add a hosting step before the first deployment, assign every file row to a step, and give each step an exit command.
* **Owner decision:** None.
* **Depends on:** Z1 would add a first delivery gate. The ordering fault exists without it.

### readiness-1-2. Open questions are wrongly treated as settings - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 999, 1003, 1027, 1251, 1289
* **Problem:** Line 1003 says the other open questions become private settings and do not change the code structure. Several of them do change it:

  | Open question (target line) | What it changes |
  | --- | --- |
  | Closing grace period (186) | Server window logic |
  | Comment timing (194) | Workflow schedules |
  | Comment approval (196) | Review screens and data |
  | Archive retention (198) | Deletion behaviour |
  | Started status (203) | Task states and the tracking flow |
  | Result rounding (205) | Calculator and golden files |
  | Adult comments (211) | Routes, audiences and review |
  | Named status access (212) | Permissions |
  | Squirrels (215) | Sections and routes, if they take part |

  The "private settings file" is also undefined. Line 999 stores settings in DistrictStatistics, while line 1027 ignores local private settings.
* **Rationale & Recommendation:** A builder relying on line 1003 would start with design decisions still open. Remove the claim. Sort each question into "setting only" or "must be decided before building", record a default or the owner's answer, and name the affected files. State one location for settings.
* **Owner decision:** Reopens no recorded decision. These are open items that need owner answers.
* **Depends on:** None.

### readiness-1-3. Formats shared between repositories are not defined - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope:** Lines 1085-1087, 1123-1126, 1227-1228, 1233-1237, 1274, 1278-1281
* **Problem:** Separate repositories must agree on values the plan does not specify:
  * the bytes covered by the invite signature, and the encoding of passes, receipts and results tokens
  * request and response bodies for the tracking routes
  * the comment file, the completion message and the results release fields
  * S3 object names, the archive format and its checksum
  * the import request and response, the batch size, and the routes for releases and survey versions
* **Rationale & Recommendation:** Two engineers working separately would make incompatible choices. Only the answer file is defined (lines 530-542). Add a contract section with exact fields, encodings, routes, status codes and one worked example of each signed value.
* **Owner decision:** None.
* **Depends on:** Z2 and Z3 change the used-record and import contracts.

### readiness-1-4. The survey file format is incomplete - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 1056, 1079-1084, 1121-1122
* **Problem:** The plan does not list the supported question types. The only example (lines 379-404) shows `single` and `multiple`. There is no syntax for free text, safeguarding panels, reviewer settings, required questions, text limits or the "new question" marker, although validation depends on some of these (lines 431-435). The settings list and compiled file layout are also missing.
* **Rationale & Recommendation:** The engine, validator, question renderer and authoring guide all depend on this format. Publish the full schema, the settings list, the `evaluateSurvey` signature and the fingerprint method.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-5. New tables have no columns, and task storage is undecided - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope:** Lines 1229-1231, 1249-1253, 1273, 1291-1292
* **Problem:** No new table in either application has columns, types, keys, indexes or retention rules. The plan also does not say whether survey tasks use DistrictWorkflow's shared `tasks` table or new survey tables. Shared tasks need a published workflow, an execution, a step and a tag.
* **Rationale & Recommendation:** The standard names database schema as a decision the plan must make. Evidence is at `DistrictWorkflow/packages/persistence/src/schema.ts:149-173` and `DistrictWorkflow/docs/workflow-data-model.md:46-60`. Give full table definitions and status values. Choose shared tasks or survey-only rows, then list the seed data, screens, permissions and repository changes that follow.
* **Owner decision:** None. The result must still satisfy decision 9.
* **Depends on:** Z3 changes the import batch data.

### readiness-1-6. The comment review loop is not closed - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope:** Lines 1146, 1236, 1239-1241, 1257, 1280-1282
* **Problem:** DistrictWorkflow must create a task for each comment, but the plan does not say how it receives the comment ID, audience and due date. Reviewers record outcomes in DistrictStatistics, and no route tells DistrictWorkflow that a comment was read, so a reviewed comment could still escalate to the deputy. No listed workflow owns the deadline timer, and no alarm covers an overdue comment.
* **Rationale & Recommendation:** Comment review is a safeguarding condition of decision 3 (`concepts_brief.md:398`), so the survey cannot open with this gap. Define the comment task API, the status sync, the timer workflow, the deputy assignment and the overdue alarm. Add a test that a reviewed comment does not escalate.
* **Owner decision:** None. This delivers the conditions attached to decision 3.
* **Depends on:** Z3 changes how comments arrive. Z1 proposes a fallback if review is late.

### codebase-1-1. The Homelab rows do not give a working deployment - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`, `egm-style`
* **Affected Scope:** Lines 1001, 1315-1326
* **Problem:** Line 1001 presents both applications as running on the cluster, but the rows create their deployments. DistrictWorkflow has no rows for PostgreSQL, a production Temporal server, a migration step, a Kubernetes Service for the web app or schedule registration. Neither application has a container image source. DistrictStatistics has no migration step or backup row. Nothing grants email sending or creates DistrictWorkflow's public address and TLS.
* **Rationale & Recommendation:** `DistrictWorkflow/docs/architecture.md:103-104` says production provisioning, credentials and backups remain to be done, and lines 110-112 require a controlled migration step. `DistrictInfrastructure/modules/workflow/README.md:155` says that module does not host the application or provide its DNS or TLS. Add the missing rows, or name the existing services and their connection settings.
* **Owner decision:** None. Decision 9 already says the production deployment needs confirming.
* **Depends on:** Z1 would make this a launch gate. The gap exists either way.

### codebase-1-2. Staff sign-in cannot be built from the listed files - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
* **Affected Scope:** Lines 1220-1221, 1272-1276, 1284-1286, 1297-1300
* **Problem:** No row creates the Cognito app client, callback addresses or `survey-analyst` group. No row names the sign-in packages, login and callback controllers, session handling or how named reviewers are identified. `StaffAuditLogger` has no storage. The plan does not say whether the existing Datasets and Pages routes will require sign-in.
* **Rationale & Recommendation:** Comment review and the analyst dashboard both rely on sign-in. `DistrictStatistics/data-core/composer.json:7-13` has no sign-in packages, and `src/Controller/DatasetsController.php:18-99` has no access checks. `DistrictInfrastructure/modules/workflow/main.tf:16-51` shows the existing pattern for a client and group. Specify the Terraform resources, packages, sign-in flow, audit table and access for each route. Add a test that existing data consumers still work.
* **Owner decision:** None. This implements the B4 sign-in requirement (`concepts_brief.md:102`).
* **Depends on:** Z1 affects timing only.

### codebase-1-3. The results build can break or expose results - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
* **Affected Scope:** Lines 1046, 1063-1064, 1092, 1126, 1162-1163, 1204
* **Problem:**
  * No listed file loads a results release. `build-data.ts` covers only the survey, settings and logos.
  * A results-only upload can leave pages pointing at script files from another build.
  * A normal site deployment could delete the results pages, because the plan sets no sync exclusions. The existing site deploy uses `aws s3 sync --delete` (`district-site/.github/workflows/deploy.yml:325`).
  * Results data passed to a client component could land in public `_next/static` files, outside the protected `/results*` path.
* **Rationale & Recommendation:** This could break results or expose them to people without access. Define the release loader, the exact upload and exclusion rules, how page and script files stay matched, and the empty-results build. Add a rule that results data renders on the server only, and a post-deployment check that every results file is refused without cookies. The Next.js behaviour here rests on general knowledge and was not tested.
* **Owner decision:** See `style-1-1`. Accepting Z4 would also reopen G24, the design choice at line 417 and possibly decision 8.
* **Depends on:** Z4. Resolve it before rewriting this section.

### codebase-1-4. There is no defined path from survey file to site build - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`, `egm-style`
* **Affected Scope:** Lines 999, 1092, 1117-1118, 1183, 1273, 1277-1279, 1305-1306
* **Problem:**
  * `SurveyVersionsController` stores definitions, settings and logos, but no command, screen or caller sends them.
  * Settings and logos have no database storage (lines 594-601).
  * `ServiceApiMiddleware` covers only DistrictWorkflow's credential, so the build has none.
  * The plan does not say how `survey:validate` finds the current and previous surveys.
  * The plan does not say how the compiled survey reaches the response Lambda, or what selects example data over live data.
* **Rationale & Recommendation:** No real survey can be built or checked from this plan. Specify the author's steps from file to deployment, the storage, the upload command, the build credential and the previous-version lookup. Use one compiled file for the site, the Lambda and DistrictStatistics. A production build must fail if real data is unavailable.
* **Owner decision:** None as written. Z4 would reopen the choices listed under `codebase-1-3`.
* **Depends on:** Z4 would replace much of this path.

## Major

### readiness-1-7. Operator controls and recovery have no implementation - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 1109, 1187, 1214, 1260, 1294, 1423, 1435
* **Problem:** The close switches have no storage location or operator command. No route or service removes open-link responses by day. CUJ 10 cites `SurveyImportServiceTest.php`, whose row covers only repeated batches and invalid records. Email resend and archive restore have no implementing file.
* **Rationale & Recommendation:** CUJ 10 and the recovery drills cannot pass as planned. Add files for the switch store, operator commands, removal API, audit record and republishing of results, each with a test.
* **Owner decision:** None. This implements the B7 resolution (`concepts_brief.md:117`).
* **Depends on:** Z3 would move archive ownership.

### readiness-1-8. Survey close-down is not implemented - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-style`
* **Affected Scope:** Lines 1120, 1238-1243, 1261, 1266, 1435
* **Problem:** Nothing starts the final results email, deletes invite UUIDs and signing keys, or removes results after 3 months (lines 649-650, 972-976). `close-survey-data.ts` covers used records only, has no test row and has no defined credentials. "Dated evidence" is undefined.
* **Rationale & Recommendation:** Deletion cannot be reversed, so the order matters. Add one close-down sequence that follows stage 7 of the brief (`concepts_brief.md:437`), with triggers, confirmation checks, tests, owners and a stated evidence format.
* **Owner decision:** None. This delivers stage 7 of the brief.
* **Depends on:** None.

### readiness-1-9. The invitation lifecycle is missing steps - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope:** Lines 1238-1246, 1254
* **Problem:** The plan does not define the volunteer list source, test send, bounce handling, link reissue, reminder timing or reminder limit. The bounce queue is shared with other applications (`DistrictInfrastructure/output.tf:73-78`).
* **Rationale & Recommendation:** Completion tracking is a core purpose of the tool. Specify each step with its command or screen, data changes and tests.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-10. Required alarms are missing or have no signal - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 1146, 1154, 1213, 1398, 1400, 1436
* **Problem:** `alarms.tf` omits overdue comments (G16, line 129), archive verification failure (line 723) and open-link abuse (line 297). The missed-import alarm has no named metric, publisher or permission. The existing contact-form alarms use `treat_missing_data = "notBreaching"` (`DistrictInfrastructure/modules/contact-form/main.tf:149,165`), so copying them would hide a missed import.
* **Rationale & Recommendation:** An alarm with no signal never fires. Add one alarm table giving the metric, publisher, threshold, missing-data rule, alert topic, owner and drill for each alarm.
* **Owner decision:** None.
* **Depends on:** Z3 changes which system reports import health.

### readiness-1-11. Terraform ownership conflicts with the design - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 1002, 1133-1134, 1138, 1145, 1220-1221
* **Problem:** Line 703 passes a certificate into the module, but line 1138 creates one inside it. Line 704 passes in role ARNs, but line 1145 creates IAM users. Line 1133 omits the Cloudflare account ID listed at line 703. The plan does not say who creates the access keys, how they reach 1Password, or whether they enter Terraform state. The pinned module address and the variable carrying the GitHub OIDC provider are not named.
* **Rationale & Recommendation:** Choose one owner for each resource and one identity model. Then list every module input and output with its type.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-12. Secret setup is undefined and has an ordering problem - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope:** Lines 1107, 1111, 1119, 1136, 1144, 1325
* **Problem:** There is no list of secrets, readers or rotation steps. The CloudFront key group needs a public key during `terraform apply`, but the key-generating script has no defined place in the order. The plan does not say how DistrictWorkflow receives its link secret and results signing key. Ed25519 is the only signature type named, and the key type for CloudFront cookies is not stated. CloudFront is understood not to accept Ed25519, but this was not tested.
* **Rationale & Recommendation:** First-time setup cannot be completed reliably without this. Add a secrets table covering name, type, generator, store, readers and rotation, plus an ordered setup procedure.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-13. The test environment is not defined - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope:** Lines 998, 1008, 1162, 1220-1221, 1349, 1435-1437
* **Problem:** The plan imports one module instance and names one domain. It gives no test domain, data services, credentials, deployment trigger or separation rules, although the deployed tests and launch rehearsal need them.
* **Rationale & Recommendation:** `DistrictInfrastructure/main.tf:39` shows the existing environment separation for the public website. Define the test environment across AWS, DistrictWorkflow, DistrictStatistics and GitHub, and how it stays separate from production.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-14. Dependencies and several file targets are open-ended - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope:** Lines 1022, 1072, 1118, 1202, 1272-1273, 1291-1292, 1309
* **Problem:** Runtime, test, sign-in, authorisation and AWS packages have no names or versions. The YAML parser, schema validator, bundler, Lambda Node version and AlignUI file list are left open. Globs and shortened paths are used for files whose names can be known now.
* **Rationale & Recommendation:** The standard allows globs only for generated files whose names cannot be known (`implementation-readiness-standard.md:29-33`). List each package with its version and purpose, and give exact repository-relative paths.
* **Owner decision:** None. Decision 11 stays in place.
* **Depends on:** None.

### readiness-1-15. Golden results and PHP tag calculation have no source - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 1201-1202, 1288-1289, 1302, 1341, 1393
* **Problem:** `results-golden.test.ts` generates the golden files, but the results calculator exists only in PHP. DistrictStatistics must recalculate tags (lines 599, 1302), yet no PHP file owns that logic, and the design treats rewriting question logic in PHP as a drawback (line 823). The plan does not say how fixtures reach the other repositories, and DistrictWorkflow has no contract test row.
* **Rationale & Recommendation:** Use reviewed, hand-written expected results or name one generator. Decide where tags are calculated. If tags travel in the answer file, update the stored-field tests. Define how fixtures are shared and their versions pinned.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-16. Quality gates have no tooling or CI outside `district-survey` - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 1272, 1332-1333, 1346-1347, 1359-1362, 1370-1375
* **Problem:**
  * No CI files are listed for DistrictWorkflow, DistrictStatistics or Homelab, although line 1375 says each repository enforces its thresholds.
  * PHPStan, Psalm and PCOV are not planned. `DistrictStatistics/data-core/composer.json:14-26` only suggests PHPStan and does not mention Psalm.
  * Nothing implements the rule at line 1333 that fails a pull request when a goal has no passing test.
  * Line 1362 requires an assertion for every `.tf` file. `versions.tf` and `variables.tf` have little to assert, and `certificate.tf` and `secrets.tf` have no named test.
* **Rationale & Recommendation:** A gate that nothing enforces gives false assurance. Add the workflows, tools, configuration and a traceability checker, or reword these as manual release checks. Set the Terraform rule per resource.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-17. Pull request browser tests have no backend - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 1034, 1161, 1178-1181, 1206-1209, 1342
* **Problem:** These tests run on GitHub-hosted runners with example data only, but they exercise Lambdas, S3, signed cookies and CloudFront rules. No mock API, local server or fixture setup is listed.
* **Rationale & Recommendation:** Add the test harness. State which behaviour is simulated in pull requests and which is checked only in `tests/deployed`.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-18. Browser and API protection settings are unspecified - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope:** Lines 1045, 1104, 1136, 1140-1141, 1150, 1431-1432
* **Problem:**
  * The Content Security Policy value is missing, including how it allows Next.js inline scripts, the theme script and Turnstile.
  * Open and tracked visits share `/survey`, and CloudFront cannot see the link token after the `#`. Line 947 bans third-party scripts on tracked pages, while open links need Turnstile.
  * The method that refuses direct API access is undefined.
  * Open and tracked submissions share one route, but the brief asks for separate limits (`concepts_brief.md:139,154,159`).
  * Lambda timeouts, memory, queue settings, log retention and throttle values are missing.
* **Rationale & Recommendation:** The launch checks test these controls, but the plan does not define them. Add exact header values for each route, the script-loading rule, the origin check and its rotation, and a table of infrastructure values.
* **Owner decision:** None.
* **Depends on:** None.

### codebase-1-5. The DistrictWorkflow file list omits required files - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
* **Affected Scope:** Lines 1230, 1235-1237, 1247
* **Problem:** Only the migration `.sql` file is listed, although the project also commits generated migration metadata (`DistrictWorkflow/docs/architecture.md:108-112`). `storage.ts` needs an S3 client that the worker does not declare (`apps/worker/package.json:30-44`), and neither `packages/integrations/package.json` nor the root lockfile is listed.
* **Rationale & Recommendation:** A list of permitted file changes built from this plan would block necessary work. Add the journal, snapshot, manifest and lockfile rows and the generation command, name the S3 package and version, and confirm that `0017` is the next free migration number.
* **Owner decision:** None.
* **Depends on:** Z3 could remove `storage.ts`. Z4 could remove `github.ts`.

### codebase-1-6. The host check can reject valid DistrictStatistics traffic - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
* **Affected Scope:** Lines 1236, 1276, 1316-1317
* **Problem:** In production, DistrictStatistics rejects any request whose host differs from `App.fullBaseUrl` (`DistrictStatistics/data-core/src/Middleware/HostHeaderMiddleware.php:47-53`). The plan defines no shared hostname for DistrictWorkflow, build runners, staff or health probes.
* **Rationale & Recommendation:** Calls inside the cluster could receive a 400 error. Define one private hostname with DNS and TLS for every caller and probe, or specify a tested list of allowed hosts.
* **Owner decision:** None.
* **Depends on:** Z4 removes the build-runner caller only.

### codebase-1-7. Invite UUIDs could remain in Temporal history - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`, `egm-style`
* **Affected Scope:** Lines 1239, 1241, 1244, 1258, 1433-1434
* **Problem:** The existing queue intake returns the message body from an activity into workflow history (`DistrictWorkflow/apps/worker/src/activities/activity-notification.ts:14-28`, `apps/worker/src/workflows/activity-notification.ts:15-18`). Copying that pattern would keep invite UUIDs in history after their planned deletion. Line 1434 says history holds "file names only", but line 573 also allows counts, and the test at line 1258 looks only for answers and comment text.
* **Rationale & Recommendation:** Process and acknowledge each message inside one activity that returns counts only. State the permitted fields for each workflow, and make the history test fail on UUIDs, signed links and any other field.
* **Owner decision:** None.
* **Depends on:** Z3 would change the import fields.

### codebase-1-8. "Send once" conflicts with the email system's guarantee - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 1238, 1242, 1254, 1256
* **Problem:** The shared email path sends at least once, so a retry can send a duplicate (`DistrictWorkflow/docs/reusable-activities.md:55`). The plan requires a single thank-you email without saying how an uncertain send is handled.
* **Rationale & Recommendation:** Specify a claim step before sending, and state whether a crash may lose an email or repeat one. Change the test wording to match that rule.
* **Owner decision:** None.
* **Depends on:** None.

### codebase-1-9. Runner access is documented but not granted or restricted - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`, `egm-style`
* **Affected Scope:** Lines 1162-1163, 1328
* **Problem:** The only row changes a README. The real controls are the organisation's runner-group policy and the token's repository access, and the runner README treats that restriction as optional (`Homelab/K8S/GitHubActionsRunnersLBDistrictScouts/README.md:21-24, 30-32`). The trigger wording also differs: "protected tagged releases" and "protected workflows" here, and protected branches at lines 942-943. AWS credentials limited to branches would not work for a deployment started from a tag.
* **Rationale & Recommendation:** A public repository using cluster runners needs an enforced limit. Add an operator step with evidence for the runner group, repository setting and token scope. Define the exact trigger and credential condition for each workflow.
* **Owner decision:** None as written. Decision 8 reopens if Z4 moves the pipeline.
* **Depends on:** Z4 would remove cluster runners.

### style-1-2. "Proves" overstates what the tests can show - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1149-1155, 1182, 1344, 1429
* **Problem:** `terraform test` with mocked providers checks configuration, so it cannot prove that each role "can reach only its own resources" (line 1152). Random tests cannot prove that rules "always hold" (line 1182). Lines 1151 and 1153 do not say what is being proved about the listed resources.
* **Rationale & Recommendation:** Readers could treat these tests as stronger evidence than they are. Use "checks" or "asserts" and name the property under test. Add a deployed access check if real IAM access must be shown.
* **Owner decision:** None.
* **Depends on:** None.

### style-1-3. Automated checks cannot establish WCAG 2.2 AA - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1181, 1343, 1386
* **Problem:** G4 requires screens to meet WCAG 2.2 AA, but its evidence is automated checks and a configuration file. Automated tools cover only part of WCAG. The screen reader testing in brief N5 (`concepts_brief.md:317`) has no plan entry.
* **Rationale & Recommendation:** Say the tools detect failures that can be found automatically. Add a named manual keyboard and screen reader check before launch.
* **Owner decision:** None.
* **Depends on:** None.

### style-1-4. Journey coverage claims contradict the traceability table - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1178-1181, 1206-1211, 1342, 1422-1425, 1437
* **Problem:** Line 1342 says end-to-end tests cover each user journey, but CUJ 9, 10 and 12 have no Playwright spec. Line 1437 says all 12 journeys pass on the test environment, yet only two deployed browser specs exist, and CUJ 9 and 12 trace to local tests.
* **Rationale & Recommendation:** Narrow line 1342, and list the deployed test or manual step for each journey.
* **Owner decision:** None.
* **Depends on:** None.

### style-1-5. Several launch checks have no test or script - Severity: Major
* **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
* **Affected Scope:** Lines 1213-1214, 1387, 1429-1435
* **Problem:** Direct API refusal has no named test. Only the restore drill has a script: replaying a failed import, expiring a results link and the close-down deletion do not. Line 1429 drops the "95% of requests" condition from line 952. The 3-second page load (line 954) and the 5-minute task target in G5 (line 81) have no check.
* **Rationale & Recommendation:** Add a named test or script and a pass condition for each check. Restate the performance target exactly as line 952 gives it.
* **Owner decision:** None.
* **Depends on:** None.

### style-1-6. The commands cannot be run as written - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1268, 1272, 1347, 1366-1377
* **Problem:** `composer install --no-dev` leaves out development tools, yet the PHP test and analysis commands run them from `vendor/bin`. The PHP commands do not say to run from `data-core/`. `terraform validate` has no directory. The deployed suite, k6 test and drills have no commands.
* **Rationale & Recommendation:** Give the working directory and setup step for each repository, and add the deployed commands.
* **Owner decision:** None.
* **Depends on:** None.

### style-1-7. "Public code" has no defined scope - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 998, 1162-1163, 1205, 1402
* **Problem:** G20 bans district-specific values from public code, and line 1205 adds a test for this. The public workflows name `lbdistrictscouts-runners`, and this public design document contains the district's domain.
* **Rationale & Recommendation:** The test would fail on the plan's own files, or would need exemptions nobody has defined. Define the paths it scans and any exemptions, and supply the runner label through a repository variable.
* **Owner decision:** None.
* **Depends on:** Z4 would remove the runner references, but the scope definition is still needed.

## Nit

### style-1-8. Mutation testing omits S3 record code - Severity: Nit
* **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
* **Affected Scope:** Lines 1033, 1340, 1356
* **Problem:** Line 1356 sets a mutation score for signing and S3 record code, but lines 1033 and 1340 limit Stryker to the survey engine and signing code.
* **Rationale & Recommendation:** The threshold cannot be measured as written. Add `functions/shared/s3-records.ts` to both lines.
* **Owner decision:** None.
* **Depends on:** None.

### readiness-1-19. The replay test has no recorded histories - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Line 1259
* **Problem:** The replay test needs recorded workflow histories, but no fixture files are listed.
* **Rationale & Recommendation:** Add the fixtures and explain how they are captured.
* **Owner decision:** None.
* **Depends on:** None.

### codebase-1-10. The `Application.php` row needs more exact wording - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 1276
* **Problem:** "Form protection" is ambiguous. The active control is the CSRF middleware (`DistrictStatistics/data-core/src/Application.php:96-98`), and the FormProtection component is commented out (`src/Controller/AppController.php:50`). New middleware must also keep the first four positions checked by `tests/TestCase/ApplicationTest.php:80-86`.
* **Rationale & Recommendation:** Name the CSRF exemption and state the middleware order.
* **Owner decision:** None.
* **Depends on:** None.

### style-1-9. Some file descriptions use vague wording - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1049, 1062, 1099, 1104, 1246, 1251
* **Problem:** "On-brand", "plain next steps", "safely", "fixed responses", "chosen volunteer group" and "permitted users" do not state behaviour that can be tested.
* **Rationale & Recommendation:** Replace each with the specific rule, or point to the section that defines it. Line 1099, for example, can say "using conditional writes".
* **Owner decision:** None.
* **Depends on:** None.

### style-1-10. Traceability labels do not match the suite names - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1337-1349, 1381-1408
* **Problem:** The goal table uses "Unit" and "deployed", which differ from the suite names. Line 1402 places `no-district-values.test.ts` under Workflow safety, which line 1345 does not describe. Line 1386 lists `.pa11yci.cjs`, a configuration file, as a test.
* **Rationale & Recommendation:** Use the exact suite names, and list only tests in the "Main tests" column.
* **Owner decision:** None.
* **Depends on:** None.

### style-1-11. Unclear pronoun in the import row - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 1280
* **Problem:** In "rejects duplicate submission IDs without failing them", "them" has no clear subject.
* **Rationale & Recommendation:** Use "without failing the batch", which matches line 585.
* **Owner decision:** None.
* **Depends on:** None.

### style-1-12. Test rows are not grouped - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 1172-1214
* **Problem:** Rows for the same folder are split, such as `tests/survey-engine` at lines 1172-1173 and 1182-1183, and `tests/e2e` at lines 1178-1181 and 1206-1209.
* **Rationale & Recommendation:** Sort the rows by path so gaps are easier to find.
* **Owner decision:** None.
* **Depends on:** None.

## Severity Differences Resolved

| Finding | Reviewers said | Final | Reason |
| --- | --- | --- | --- |
| `style-1-1` | Major (style); part of a Blocker (codebase) | Blocker | The brief says its decisions apply, so the conflict must be settled before building. |
| `readiness-1-1` | Blocker (readiness, codebase); Major (style) | Blocker | The steps cannot be followed in the stated order. |
| `readiness-1-5` | Blocker (readiness, codebase); Major for the task model (codebase) | Blocker | The standard names database schema as a required decision. |
| `readiness-1-6` | Blocker (readiness); Major (codebase) | Blocker | It is a safeguarding launch condition. |
| `codebase-1-1` | Blocker (readiness, codebase); Major (style) | Blocker | The applications cannot run from the listed files. |
| `codebase-1-4` | Blocker (readiness, codebase); Major (style) | Blocker | No real survey can be built. |
| `readiness-1-14` | Major (readiness, codebase); Nit for the globs (readiness) | Major | Unnamed packages leave decisions to the builder. |
| `readiness-1-16` | Major (all three); Nit for the Terraform rule (readiness) | Major | The main gap is gates that nothing enforces. |
| `codebase-1-9` | Major (codebase, style); Nit (readiness) | Major | The restriction protects cluster runners used by a public repository. |
| `style-1-8` | Major (style); Nit (readiness) | Nit | It is a one-line correction. |

## Limits of This Review

* **Nothing was built or run.** Live AWS, GitHub, Cloudflare and cluster settings were not inspected.
* **General knowledge, not tested:** CloudFront, S3, Next.js, Cognito, Drizzle and WCAG tool behaviour, except where a finding cites a file.
* **Excluded by the review rules:** the DistrictStatistics `config` directory and `.env.example` files. The rows at lines 1248 and 1273-1275 could not be checked against the current files.
* **Outside the supplied paths:**
  * DistrictWorkflow `packages/integrations`, `apps/web`, `apps/worker/tests`, the migrations folder and the root manifests. The migration number `0017` is unconfirmed.
  * Homelab outside the runner folder. If Temporal, PostgreSQL or application manifests exist there, `codebase-1-1` narrows to naming them and wiring the connections.
  * Root Terraform files other than `main.tf` and `output.tf`.
* **Owner approval:** `style-1-1` rests on `concepts_brief.md` and the target document. Approval given elsewhere would not be visible to this review.
