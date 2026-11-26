# Goldfish Annotated Review Report

**Target:** `../district_survey.md` (DetailedRange, lines 994-1441)

**Status:** resolved

**Outcome:** 39 fixes applied, 1 escalated finding confirmed by the owner and recorded, 1 Nit declined, 0 contested. Owner decisions: Z1 option B, Z2 option A, Z3 option B, Z4 protected results data files with cluster builds. Owner additions during the walkthrough were also applied: local development with Moto, a 48-hour review limit for all free text, a DistrictWorkflow reviewer pool, DistrictWorkflow as the only staff interface, JSON Schema and OpenAPI contracts, CI/CD based on `district-team` and `district-site`, and hosting moved to a separate plan.

## Summary

| Category | Findings |
| --- | --- |
| PROPOSE FIX | 39 |
| ESCALATE | 1 |
| CONTEST | 0 |
| DECLINE | 1 |
| **Total** | **41** |

14 proposed fixes depend on one or more of the four decisions below.

## Decisions Needed First

These come from `intermediate_zoom_out_report.md`. They settle or narrow about 25 findings from Stages 5 to 9.

| ID | Decision | Reviewer's proposal | Keep the current design |
| --- | --- | --- | --- |
| Z1 | What must be live on opening day | DistrictWorkflow, DistrictStatistics, import, comment review, sign-in and alarms are required. Results and analyst access can follow. If comment review is late, open without comment boxes | Everything is required on opening day, with no fallback |
| Z2 | How a tracked link records completion | The response Lambda saves the answer and records the link as used. Receipts remain for open-link responses only, and the optional volunteer step is removed | The browser carries a receipt between the two Lambdas, and the optional step must be fully defined |
| Z3 | How answers reach DistrictStatistics | DistrictStatistics imports one completed day at a time, and DistrictWorkflow receives counts only. Exact upload times last about 26 hours | DistrictWorkflow streams 12-hour batches, using private file references |
| Z4 | How the site and results are built | One public results page loads protected data files. Survey files move to a private repository, and builds use GitHub-hosted runners | Cluster runners build pages using DistrictStatistics data, with stricter runner limits |

## Prioritized Findings & AI Suggestions

### [Issue 1] style-1-1: The plan differs from recorded owner decisions without saying so [`egm-style`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** Lines 1046-1047, 1098-1103, 1111, 1135, 1163
*   **Discrepancy Description:** Decision 9 says the submit Lambda sends the UUID to the queue. The plan has a separate tracking Lambda do this, and the response Lambda never accepts a UUID (lines 1098, 1102). Decision 9c says results are held in a private bucket and "served only through that API". The plan instead publishes built results pages to the site bucket and protects them with CloudFront signed cookies (lines 1046, 1111, 1163, and line 623). Decision 7 keeps results in a separate private bucket, which the plan does only for the release data (line 1135).
*   **Rationale:** The brief says its decisions apply where other text differs (`concepts_brief.md:20`), so a builder cannot tell which source to follow. The design records signed cookies as the author's choice (lines 854, 862), but the brief records no owner approval of the change. Record the owner's approval and update the brief, or change the plan to match the decisions.
*   ***AI Suggestion:*** ESCALATE
*   ***Justification:*** The reviewers could not see the owner's approval because it was given during drafting and never copied into the brief. The owner chose the two-Lambda design and CloudFront signed cookies in that conversation. Publishing built results pages follows the owner's request for a GitHub Action to regenerate the static results.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    * Change: After the owner confirms, add a "Changes from the concepts brief" section to the design listing decisions 7, 9 and 9c, what replaced each, and why. Update the matching rows in `concepts_brief.md`.

### [Issue 2] readiness-1-1: The delivery order cannot be followed [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** Lines 1005-1012, 1092, 1220, 1311-1328, 1349, 1436-1437
*   **Discrepancy Description:** Step 2 needs a test deployment, but the Terraform arrives in step 3. Step 4 builds an import against a DistrictStatistics API that arrives in step 5, and real site builds need that API too. The 14 Homelab rows belong to no step. File rows are not assigned to steps, and no step has an exit check. Step 2 also leaves out the signed link and queue proof that stage 1 of the brief requires (`concepts_brief.md:431`).
*   **Rationale:** The standard requires each phase to leave the code buildable and testable. Reorder the steps, add a hosting step before the first deployment, assign every file row to a step, and give each step an exit command.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The steps cannot be followed in the stated order.
*   ***Depends on:*** Z1
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Replace "Delivery order" with ordered phases: hosting and production readiness, survey engine, Terraform and test environment, thin slice, DistrictStatistics APIs, DistrictWorkflow integration, results and operations. Assign every file row to a phase and give each phase an exit command.

### [Issue 3] readiness-1-2: Open questions are wrongly treated as settings [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** Lines 999, 1003, 1027, 1251, 1289
*   **Discrepancy Description:** Line 1003 says the other open questions become private settings and do not change the code structure. Several of them do change it:

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
*   **Rationale:** A builder relying on line 1003 would start with design decisions still open. Remove the claim. Sort each question into "setting only" or "must be decided before building", record a default or the owner's answer, and name the affected files. State one location for settings.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Several open questions change code, so the claim at line 1003 is false.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Delete the claim. Replace Open Questions with a table showing the owner, the deadline, whether it blocks building, the default and the affected files. Name DistrictStatistics as the single location for settings, unless Z4 changes it.

### [Issue 4] readiness-1-3: Formats shared between repositories are not defined [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** Lines 1085-1087, 1123-1126, 1227-1228, 1233-1237, 1274, 1278-1281
*   **Discrepancy Description:** Separate repositories must agree on values the plan does not specify:
  * the bytes covered by the invite signature, and the encoding of passes, receipts and results tokens
  * request and response bodies for the tracking routes
  * the comment file, the completion message and the results release fields
  * S3 object names, the archive format and its checksum
  * the import request and response, the batch size, and the routes for releases and survey versions
*   **Rationale:** Two engineers working separately would make incompatible choices. Only the answer file is defined (lines 530-542). Add a contract section with exact fields, encodings, routes, status codes and one worked example of each signed value.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Separate repositories cannot agree on undefined formats.
*   ***Depends on:*** Z2, Z3
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add a "Shared contracts" section with exact fields, encodings, object names, routes, status codes and a worked example of each signed value, message and file.

### [Issue 5] readiness-1-4: The survey file format is incomplete [`egm-implementation-readiness`] - Severity: Blocker
*   **Affected Scope:** Lines 1056, 1079-1084, 1121-1122
*   **Discrepancy Description:** The plan does not list the supported question types. The only example (lines 379-404) shows `single` and `multiple`. There is no syntax for free text, safeguarding panels, reviewer settings, required questions, text limits or the "new question" marker, although validation depends on some of these (lines 431-435). The settings list and compiled file layout are also missing.
*   **Rationale:** The engine, validator, question renderer and authoring guide all depend on this format. Publish the full schema, the settings list, the `evaluateSurvey` signature and the fingerprint method.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The engine, validator and renderer all depend on this format.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add the full survey schema: question types, free text, safeguarding panels, reviewer settings, required answers, limits, the new-question marker, the settings list, the compiled layout, the `evaluateSurvey` signature and the fingerprint method.

### [Issue 6] readiness-1-5: New tables have no columns, and task storage is undecided [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** Lines 1229-1231, 1249-1253, 1273, 1291-1292
*   **Discrepancy Description:** No new table in either application has columns, types, keys, indexes or retention rules. The plan also does not say whether survey tasks use DistrictWorkflow's shared `tasks` table or new survey tables. Shared tasks need a published workflow, an execution, a step and a tag.
*   **Rationale:** The standard names database schema as a decision the plan must make. Evidence is at `DistrictWorkflow/packages/persistence/src/schema.ts:149-173` and `DistrictWorkflow/docs/workflow-data-model.md:46-60`. Give full table definitions and status values. Choose shared tasks or survey-only rows, then list the seed data, screens, permissions and repository changes that follow.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Database schema is a required implementation decision. The owner described each invitation as a DistrictWorkflow task, so the plan should use the shared `tasks` table.
*   ***Depends on:*** Z3
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add full table definitions for both applications. Use DistrictWorkflow's shared `tasks` table with a published survey workflow, and add a survey invitation table for the link UUID and delivery status.

### [Issue 7] readiness-1-6: The comment review loop is not closed [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** Lines 1146, 1236, 1239-1241, 1257, 1280-1282
*   **Discrepancy Description:** DistrictWorkflow must create a task for each comment, but the plan does not say how it receives the comment ID, audience and due date. Reviewers record outcomes in DistrictStatistics, and no route tells DistrictWorkflow that a comment was read, so a reviewed comment could still escalate to the deputy. No listed workflow owns the deadline timer, and no alarm covers an overdue comment.
*   **Rationale:** Comment review is a safeguarding condition of decision 3 (`concepts_brief.md:398`), so the survey cannot open with this gap. Define the comment task API, the status sync, the timer workflow, the deputy assignment and the overdue alarm. Add a test that a reviewed comment does not escalate.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Comment review is a safeguarding launch condition.
*   ***Depends on:*** Z3
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Define the comment list API, task creation, status sync, deadline timer, deputy assignment, final escalation and overdue alarm. Add a test that a reviewed comment does not escalate.

### [Issue 8] codebase-1-1: The Homelab rows do not give a working deployment [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** Lines 1001, 1315-1326
*   **Discrepancy Description:** Line 1001 presents both applications as running on the cluster, but the rows create their deployments. DistrictWorkflow has no rows for PostgreSQL, a production Temporal server, a migration step, a Kubernetes Service for the web app or schedule registration. Neither application has a container image source. DistrictStatistics has no migration step or backup row. Nothing grants email sending or creates DistrictWorkflow's public address and TLS.
*   **Rationale:** `DistrictWorkflow/docs/architecture.md:103-104` says production provisioning, credentials and backups remain to be done, and lines 110-112 require a controlled migration step. `DistrictInfrastructure/modules/workflow/README.md:155` says that module does not host the application or provide its DNS or TLS. Add the missing rows, or name the existing services and their connection settings.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The listed manifests cannot run either application.
*   ***Depends on:*** Z1
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add container image builds, DistrictWorkflow PostgreSQL, Temporal, migrations, Services, public address and TLS, DistrictStatistics migrations and backups, or name the existing services after checking `Homelab`.

### [Issue 9] codebase-1-2: Staff sign-in cannot be built from the listed files [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Blocker
*   **Affected Scope:** Lines 1220-1221, 1272-1276, 1284-1286, 1297-1300
*   **Discrepancy Description:** No row creates the Cognito app client, callback addresses or `survey-analyst` group. No row names the sign-in packages, login and callback controllers, session handling or how named reviewers are identified. `StaffAuditLogger` has no storage. The plan does not say whether the existing Datasets and Pages routes will require sign-in.
*   **Rationale:** Comment review and the analyst dashboard both rely on sign-in. `DistrictStatistics/data-core/composer.json:7-13` has no sign-in packages, and `src/Controller/DatasetsController.php:18-99` has no access checks. `DistrictInfrastructure/modules/workflow/main.tf:16-51` shows the existing pattern for a client and group. Specify the Terraform resources, packages, sign-in flow, audit table and access for each route. Add a test that existing data consumers still work.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Comment review and analyst access both need sign-in.
*   ***Depends on:*** Z1
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add the Cognito client, callback addresses and groups in Terraform, the CakePHP packages, login and callback controllers, session rules, reviewer identity, audit table and access rules for existing routes.

### [Issue 10] codebase-1-3: The results build can break or expose results [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Blocker
*   **Affected Scope:** Lines 1046, 1063-1064, 1092, 1126, 1162-1163, 1204
*   **Discrepancy Description:** * No listed file loads a results release. `build-data.ts` covers only the survey, settings and logos.
  * A results-only upload can leave pages pointing at script files from another build.
  * A normal site deployment could delete the results pages, because the plan sets no sync exclusions. The existing site deploy uses `aws s3 sync --delete` (`district-site/.github/workflows/deploy.yml:325`).
  * Results data passed to a client component could land in public `_next/static` files, outside the protected `/results*` path.
*   **Rationale:** This could break results or expose them to people without access. Define the release loader, the exact upload and exclusion rules, how page and script files stay matched, and the empty-results build. Add a rule that results data renders on the server only, and a post-deployment check that every results file is refused without cookies. The Next.js behaviour here rests on general knowledge and was not tested.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** As written, the results build can break pages or expose data.
*   ***Depends on:*** Z4
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: If the current build stays, add a release loader, upload rules, delete exclusions, matched assets, server-only results data and a check that results are refused without cookies. If Z4 is accepted, replace this with one static page and protected data files.

### [Issue 11] codebase-1-4: There is no defined path from survey file to site build [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** Lines 999, 1092, 1117-1118, 1183, 1273, 1277-1279, 1305-1306
*   **Discrepancy Description:** * `SurveyVersionsController` stores definitions, settings and logos, but no command, screen or caller sends them.
  * Settings and logos have no database storage (lines 594-601).
  * `ServiceApiMiddleware` covers only DistrictWorkflow's credential, so the build has none.
  * The plan does not say how `survey:validate` finds the current and previous surveys.
  * The plan does not say how the compiled survey reaches the response Lambda, or what selects example data over live data.
*   **Rationale:** No real survey can be built or checked from this plan. Specify the author's steps from file to deployment, the storage, the upload command, the build credential and the previous-version lookup. Use one compiled file for the site, the Lambda and DistrictStatistics. A production build must fail if real data is unavailable.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** No real survey can reach a build from this plan.
*   ***Depends on:*** Z4
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Describe the author's path from file to deployment, with storage, upload command, build credential, previous-version lookup and one compiled file for every system. Production builds fail if real data is unavailable.

### [Issue 12] readiness-1-7: Operator controls and recovery have no implementation [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1109, 1187, 1214, 1260, 1294, 1423, 1435
*   **Discrepancy Description:** The close switches have no storage location or operator command. No route or service removes open-link responses by day. CUJ 10 cites `SurveyImportServiceTest.php`, whose row covers only repeated batches and invalid records. Email resend and archive restore have no implementing file.
*   **Rationale:** CUJ 10 and the recovery drills cannot pass as planned. Add files for the switch store, operator commands, removal API, audit record and republishing of results, each with a test.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** CUJ 10 and the recovery drills cannot pass as planned.
*   ***Depends on:*** Z3
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add files and tests for the close switches, operator commands, response removal, audit record, results republishing, email resend and archive restore.

### [Issue 13] readiness-1-8: Survey close-down is not implemented [`egm-implementation-readiness`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1120, 1238-1243, 1261, 1266, 1435
*   **Discrepancy Description:** Nothing starts the final results email, deletes invite UUIDs and signing keys, or removes results after 3 months (lines 649-650, 972-976). `close-survey-data.ts` covers used records only, has no test row and has no defined credentials. "Dated evidence" is undefined.
*   **Rationale:** Deletion cannot be reversed, so the order matters. Add one close-down sequence that follows stage 7 of the brief (`concepts_brief.md:437`), with triggers, confirmation checks, tests, owners and a stated evidence format.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Deletion cannot be reversed, so its order must be defined.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add one close-down sequence with triggers, confirmation checks, owners, tests and the evidence format, including the final results email and 3-month results removal.

### [Issue 14] readiness-1-9: The invitation lifecycle is missing steps [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Lines 1238-1246, 1254
*   **Discrepancy Description:** The plan does not define the volunteer list source, test send, bounce handling, link reissue, reminder timing or reminder limit. The bounce queue is shared with other applications (`DistrictInfrastructure/output.tf:73-78`).
*   **Rationale:** Completion tracking is a core purpose of the tool. Specify each step with its command or screen, data changes and tests.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Completion tracking depends on this lifecycle.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add the volunteer source, preview, test send, invitations, two reminders, bounce handling filtered by sending identity, link reissue, late additions and closing.

### [Issue 15] readiness-1-10: Required alarms are missing or have no signal [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1146, 1154, 1213, 1398, 1400, 1436
*   **Discrepancy Description:** `alarms.tf` omits overdue comments (G16, line 129), archive verification failure (line 723) and open-link abuse (line 297). The missed-import alarm has no named metric, publisher or permission. The existing contact-form alarms use `treat_missing_data = "notBreaching"` (`DistrictInfrastructure/modules/contact-form/main.tf:149,165`), so copying them would hide a missed import.
*   **Rationale:** An alarm with no signal never fires. Add one alarm table giving the metric, publisher, threshold, missing-data rule, alert topic, owner and drill for each alarm.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** An alarm with no signal never fires.
*   ***Depends on:*** Z3
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add one alarm table with metric, publisher, threshold, missing-data rule, alert topic, owner and drill, including overdue comments, archive failure, open-link abuse and missed imports.

### [Issue 16] readiness-1-11: Terraform ownership conflicts with the design [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1002, 1133-1134, 1138, 1145, 1220-1221
*   **Discrepancy Description:** Line 703 passes a certificate into the module, but line 1138 creates one inside it. Line 704 passes in role ARNs, but line 1145 creates IAM users. Line 1133 omits the Cloudflare account ID listed at line 703. The plan does not say who creates the access keys, how they reach 1Password, or whether they enter Terraform state. The pinned module address and the variable carrying the GitHub OIDC provider are not named.
*   **Rationale:** Choose one owner for each resource and one identity model. Then list every module input and output with its type.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Each resource needs one owner.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Have the module create the certificate and limited IAM users, list every input and output with its type, name the pinned source and OIDC provider input, and define how access keys reach 1Password.

### [Issue 17] readiness-1-12: Secret setup is undefined and has an ordering problem [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Lines 1107, 1111, 1119, 1136, 1144, 1325
*   **Discrepancy Description:** There is no list of secrets, readers or rotation steps. The CloudFront key group needs a public key during `terraform apply`, but the key-generating script has no defined place in the order. The plan does not say how DistrictWorkflow receives its link secret and results signing key. Ed25519 is the only signature type named, and the key type for CloudFront cookies is not stated. CloudFront is understood not to accept Ed25519, but this was not tested.
*   **Rationale:** First-time setup cannot be completed reliably without this. Add a secrets table covering name, type, generator, store, readers and rotation, plus an ordered setup procedure.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** First-time setup needs a defined order. CloudFront signed cookies need a supported key type.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add a secrets table and ordered setup procedure. Use an RSA 2048 or ECDSA P-256 key for CloudFront, and keep Ed25519 for the application's own signed values.

### [Issue 18] readiness-1-13: The test environment is not defined [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Lines 998, 1008, 1162, 1220-1221, 1349, 1435-1437
*   **Discrepancy Description:** The plan imports one module instance and names one domain. It gives no test domain, data services, credentials, deployment trigger or separation rules, although the deployed tests and launch rehearsal need them.
*   **Rationale:** `DistrictInfrastructure/main.tf:39` shows the existing environment separation for the public website. Define the test environment across AWS, DistrictWorkflow, DistrictStatistics and GitHub, and how it stays separate from production.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The deployed tests need a separate environment.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Define the test domain, AWS resources, application instances, credentials, deployment trigger and separation rules.

### [Issue 19] readiness-1-14: Dependencies and several file targets are open-ended [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Lines 1022, 1072, 1118, 1202, 1272-1273, 1291-1292, 1309
*   **Discrepancy Description:** Runtime, test, sign-in, authorisation and AWS packages have no names or versions. The YAML parser, schema validator, bundler, Lambda Node version and AlignUI file list are left open. Globs and shortened paths are used for files whose names can be known now.
*   **Rationale:** The standard allows globs only for generated files whose names cannot be known (`implementation-readiness-standard.md:29-33`). List each package with its version and purpose, and give exact repository-relative paths.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Unnamed packages leave decisions to the builder.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: List each package with its version and purpose, name the Lambda Node.js version and AlignUI files, and replace avoidable globs with exact paths.

### [Issue 20] readiness-1-15: Golden results and PHP tag calculation have no source [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1201-1202, 1288-1289, 1302, 1341, 1393
*   **Discrepancy Description:** `results-golden.test.ts` generates the golden files, but the results calculator exists only in PHP. DistrictStatistics must recalculate tags (lines 599, 1302), yet no PHP file owns that logic, and the design treats rewriting question logic in PHP as a drawback (line 823). The plan does not say how fixtures reach the other repositories, and DistrictWorkflow has no contract test row.
*   **Rationale:** Use reviewed, hand-written expected results or name one generator. Decide where tags are calculated. If tags travel in the answer file, update the stored-field tests. Define how fixtures are shared and their versions pinned.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Two implementations of tag logic can disagree.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Have the response Lambda write reporting tags into the answer file, add that field to the approved list, use reviewed expected results, and define how fixtures are shared and pinned.

### [Issue 21] readiness-1-16: Quality gates have no tooling or CI outside `district-survey` [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1272, 1332-1333, 1346-1347, 1359-1362, 1370-1375
*   **Discrepancy Description:** * No CI files are listed for DistrictWorkflow, DistrictStatistics or Homelab, although line 1375 says each repository enforces its thresholds.
  * PHPStan, Psalm and PCOV are not planned. `DistrictStatistics/data-core/composer.json:14-26` only suggests PHPStan and does not mention Psalm.
  * Nothing implements the rule at line 1333 that fails a pull request when a goal has no passing test.
  * Line 1362 requires an assertion for every `.tf` file. `versions.tf` and `variables.tf` have little to assert, and `certificate.tf` and `secrets.tf` have no named test.
*   **Rationale:** A gate that nothing enforces gives false assurance. Add the workflows, tools, configuration and a traceability checker, or reword these as manual release checks. Set the Terraform rule per resource.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** A gate that nothing enforces gives false assurance.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add CI files, PHP tools, coverage settings and a traceability checker for each repository, and set the Terraform assertion rule per resource.

### [Issue 22] readiness-1-17: Pull request browser tests have no backend [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1034, 1161, 1178-1181, 1206-1209, 1342
*   **Discrepancy Description:** These tests run on GitHub-hosted runners with example data only, but they exercise Lambdas, S3, signed cookies and CloudFront rules. No mock API, local server or fixture setup is listed.
*   **Rationale:** Add the test harness. State which behaviour is simulated in pull requests and which is checked only in `tests/deployed`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Pull request browser tests need a backend.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add a local mock API and fixture setup, and state which behaviour is simulated and which is checked only on the deployed test environment.

### [Issue 23] readiness-1-18: Browser and API protection settings are unspecified [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Lines 1045, 1104, 1136, 1140-1141, 1150, 1431-1432
*   **Discrepancy Description:** * The Content Security Policy value is missing, including how it allows Next.js inline scripts, the theme script and Turnstile.
  * Open and tracked visits share `/survey`, and CloudFront cannot see the link token after the `#`. Line 947 bans third-party scripts on tracked pages, while open links need Turnstile.
  * The method that refuses direct API access is undefined.
  * Open and tracked submissions share one route, but the brief asks for separate limits (`concepts_brief.md:139,154,159`).
  * Lambda timeouts, memory, queue settings, log retention and throttle values are missing.
*   **Rationale:** The launch checks test these controls, but the plan does not define them. Add exact header values for each route, the script-loading rule, the origin check and its rotation, and a table of infrastructure values.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The launch checks test values the plan does not define.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add exact security headers, a separate tracked page path, the origin check, separate open and tracked routes, and a table of Lambda, queue, log and throttle values.

### [Issue 24] codebase-1-5: The DistrictWorkflow file list omits required files [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** Lines 1230, 1235-1237, 1247
*   **Discrepancy Description:** Only the migration `.sql` file is listed, although the project also commits generated migration metadata (`DistrictWorkflow/docs/architecture.md:108-112`). `storage.ts` needs an S3 client that the worker does not declare (`apps/worker/package.json:30-44`), and neither `packages/integrations/package.json` nor the root lockfile is listed.
*   **Rationale:** A list of permitted file changes built from this plan would block necessary work. Add the journal, snapshot, manifest and lockfile rows and the generation command, name the S3 package and version, and confirm that `0017` is the next free migration number.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The file list is incomplete. Migration `0017` is the next free number, because the repository's latest migration is `0016`.
*   ***Depends on:*** Z3, Z4
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add migration metadata, package manifests, the lockfile, the S3 package and the generation command.

### [Issue 25] codebase-1-6: The host check can reject valid DistrictStatistics traffic [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** Lines 1236, 1276, 1316-1317
*   **Discrepancy Description:** In production, DistrictStatistics rejects any request whose host differs from `App.fullBaseUrl` (`DistrictStatistics/data-core/src/Middleware/HostHeaderMiddleware.php:47-53`). The plan defines no shared hostname for DistrictWorkflow, build runners, staff or health probes.
*   **Rationale:** Calls inside the cluster could receive a 400 error. Define one private hostname with DNS and TLS for every caller and probe, or specify a tested list of allowed hosts.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Calls inside the cluster could be rejected.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Define one private hostname with DNS and TLS for DistrictStatistics, and use it for every caller and health probe.

### [Issue 26] codebase-1-7: Invite UUIDs could remain in Temporal history [`egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1239, 1241, 1244, 1258, 1433-1434
*   **Discrepancy Description:** The existing queue intake returns the message body from an activity into workflow history (`DistrictWorkflow/apps/worker/src/activities/activity-notification.ts:14-28`, `apps/worker/src/workflows/activity-notification.ts:15-18`). Copying that pattern would keep invite UUIDs in history after their planned deletion. Line 1434 says history holds "file names only", but line 573 also allows counts, and the test at line 1258 looks only for answers and comment text.
*   **Rationale:** Process and acknowledge each message inside one activity that returns counts only. State the permitted fields for each workflow, and make the history test fail on UUIDs, signed links and any other field.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Copying the existing pattern would keep UUIDs in Temporal history.
*   ***Depends on:*** Z3
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Process and acknowledge each completion inside one activity that returns counts only. Extend the history test to reject UUIDs and signed links.

### [Issue 27] codebase-1-8: "Send once" conflicts with the email system's guarantee [`egm-codebase-details`] - Severity: Major
*   **Affected Scope:** Lines 1238, 1242, 1254, 1256
*   **Discrepancy Description:** The shared email path sends at least once, so a retry can send a duplicate (`DistrictWorkflow/docs/reusable-activities.md:55`). The plan requires a single thank-you email without saying how an uncertain send is handled.
*   **Rationale:** Specify a claim step before sending, and state whether a crash may lose an email or repeat one. Change the test wording to match that rule.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The email system sends at least once.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add a claim before sending, and state that a rare duplicate is possible after an uncertain send.

### [Issue 28] codebase-1-9: Runner access is documented but not granted or restricted [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1162-1163, 1328
*   **Discrepancy Description:** The only row changes a README. The real controls are the organisation's runner-group policy and the token's repository access, and the runner README treats that restriction as optional (`Homelab/K8S/GitHubActionsRunnersLBDistrictScouts/README.md:21-24, 30-32`). The trigger wording also differs: "protected tagged releases" and "protected workflows" here, and protected branches at lines 942-943. AWS credentials limited to branches would not work for a deployment started from a tag.
*   **Rationale:** A public repository using cluster runners needs an enforced limit. Add an operator step with evidence for the runner group, repository setting and token scope. Define the exact trigger and credential condition for each workflow.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Documentation alone does not restrict the runners.
*   ***Depends on:*** Z4
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add operator steps and evidence for the runner group and token scope, and define the exact trigger and AWS credential condition for each workflow.

### [Issue 29] style-1-2: "Proves" overstates what the tests can show [`egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1149-1155, 1182, 1344, 1429
*   **Discrepancy Description:** `terraform test` with mocked providers checks configuration, so it cannot prove that each role "can reach only its own resources" (line 1152). Random tests cannot prove that rules "always hold" (line 1182). Lines 1151 and 1153 do not say what is being proved about the listed resources.
*   **Rationale:** Readers could treat these tests as stronger evidence than they are. Use "checks" or "asserts" and name the property under test. Add a deployed access check if real IAM access must be shown.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The tests check configuration and sampled behaviour, so "proves" overstates them.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Replace "proves" with "checks" and name each property. Add a deployed IAM access check.

### [Issue 30] style-1-3: Automated checks cannot establish WCAG 2.2 AA [`egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1181, 1343, 1386
*   **Discrepancy Description:** G4 requires screens to meet WCAG 2.2 AA, but its evidence is automated checks and a configuration file. Automated tools cover only part of WCAG. The screen reader testing in brief N5 (`concepts_brief.md:317`) has no plan entry.
*   **Rationale:** Say the tools detect failures that can be found automatically. Add a named manual keyboard and screen reader check before launch.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Automated tools cover only part of WCAG.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: State what the tools detect, and add a manual keyboard and screen reader check before launch.

### [Issue 31] style-1-4: Journey coverage claims contradict the traceability table [`egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1178-1181, 1206-1211, 1342, 1422-1425, 1437
*   **Discrepancy Description:** Line 1342 says end-to-end tests cover each user journey, but CUJ 9, 10 and 12 have no Playwright spec. Line 1437 says all 12 journeys pass on the test environment, yet only two deployed browser specs exist, and CUJ 9 and 12 trace to local tests.
*   **Rationale:** Narrow line 1342, and list the deployed test or manual step for each journey.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The coverage claim contradicts the traceability table.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Narrow the end-to-end claim, and list the deployed test or manual step for each journey.

### [Issue 32] style-1-5: Several launch checks have no test or script [`egm-style`, `egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** Lines 1213-1214, 1387, 1429-1435
*   **Discrepancy Description:** Direct API refusal has no named test. Only the restore drill has a script: replaying a failed import, expiring a results link and the close-down deletion do not. Line 1429 drops the "95% of requests" condition from line 952. The 3-second page load (line 954) and the 5-minute task target in G5 (line 81) have no check.
*   **Rationale:** Add a named test or script and a pass condition for each check. Restate the performance target exactly as line 952 gives it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Each launch check needs a test and a pass condition.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add named checks for direct API refusal, import replay, link expiry, close-down, page load and the 5-minute task target, and restate the 95% response target.

### [Issue 33] style-1-6: The commands cannot be run as written [`egm-style`] - Severity: Major
*   **Affected Scope:** Lines 1268, 1272, 1347, 1366-1377
*   **Discrepancy Description:** `composer install --no-dev` leaves out development tools, yet the PHP test and analysis commands run them from `vendor/bin`. The PHP commands do not say to run from `data-core/`. `terraform validate` has no directory. The deployed suite, k6 test and drills have no commands.
*   **Rationale:** Give the working directory and setup step for each repository, and add the deployed commands.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The commands cannot be run as written.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Give the working directory and setup step for each repository, and add the deployed test commands.

### [Issue 34] style-1-7: "Public code" has no defined scope [`egm-style`] - Severity: Major
*   **Affected Scope:** Lines 998, 1162-1163, 1205, 1402
*   **Discrepancy Description:** G20 bans district-specific values from public code, and line 1205 adds a test for this. The public workflows name `lbdistrictscouts-runners`, and this public design document contains the district's domain.
*   **Rationale:** The test would fail on the plan's own files, or would need exemptions nobody has defined. Define the paths it scans and any exemptions, and supply the runner label through a repository variable.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The test needs a defined scope.
*   ***Depends on:*** Z4
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Define the scanned paths and exemptions, and supply the runner label through a repository variable.

### [Issue 35] style-1-8: Mutation testing omits S3 record code [`egm-style`, `egm-implementation-readiness`] - Severity: Nit
*   **Affected Scope:** Lines 1033, 1340, 1356
*   **Discrepancy Description:** Line 1356 sets a mutation score for signing and S3 record code, but lines 1033 and 1340 limit Stryker to the survey engine and signing code.
*   **Rationale:** The threshold cannot be measured as written. Add `functions/shared/s3-records.ts` to both lines.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is a one-line correction.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add `functions/shared/s3-records.ts` to the mutation test scope.

### [Issue 36] readiness-1-19: The replay test has no recorded histories [`egm-implementation-readiness`] - Severity: Nit
*   **Affected Scope:** Line 1259
*   **Discrepancy Description:** The replay test needs recorded workflow histories, but no fixture files are listed.
*   **Rationale:** Add the fixtures and explain how they are captured.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The replay test needs recorded histories.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Add the fixture files and explain how they are captured.

### [Issue 37] codebase-1-10: The `Application.php` row needs more exact wording [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** Line 1276
*   **Discrepancy Description:** "Form protection" is ambiguous. The active control is the CSRF middleware (`DistrictStatistics/data-core/src/Application.php:96-98`), and the FormProtection component is commented out (`src/Controller/AppController.php:50`). New middleware must also keep the first four positions checked by `tests/TestCase/ApplicationTest.php:80-86`.
*   **Rationale:** Name the CSRF exemption and state the middleware order.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The wording should name the active control.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Name the CSRF exemption and state the middleware order.

### [Issue 38] style-1-9: Some file descriptions use vague wording [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 1049, 1062, 1099, 1104, 1246, 1251
*   **Discrepancy Description:** "On-brand", "plain next steps", "safely", "fixed responses", "chosen volunteer group" and "permitted users" do not state behaviour that can be tested.
*   **Rationale:** Replace each with the specific rule, or point to the section that defines it. Line 1099, for example, can say "using conditional writes".
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** These descriptions cannot be tested.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Replace each vague phrase with the specific behaviour.

### [Issue 39] style-1-10: Traceability labels do not match the suite names [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 1337-1349, 1381-1408
*   **Discrepancy Description:** The goal table uses "Unit" and "deployed", which differ from the suite names. Line 1402 places `no-district-values.test.ts` under Workflow safety, which line 1345 does not describe. Line 1386 lists `.pa11yci.cjs`, a configuration file, as a test.
*   **Rationale:** Use the exact suite names, and list only tests in the "Main tests" column.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The labels should match the suite names.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Use the exact suite names, and list only tests in the "Main tests" column.

### [Issue 40] style-1-11: Unclear pronoun in the import row [`egm-style`] - Severity: Nit
*   **Affected Scope:** Line 1280
*   **Discrepancy Description:** In "rejects duplicate submission IDs without failing them", "them" has no clear subject.
*   **Rationale:** Use "without failing the batch", which matches line 585.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is a one-word clarity fix.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: Change the row to "without failing the batch".

### [Issue 41] style-1-12: Test rows are not grouped [`egm-style`] - Severity: Nit
*   **Affected Scope:** Lines 1172-1214
*   **Discrepancy Description:** Rows for the same folder are split, such as `tests/survey-engine` at lines 1172-1173 and 1182-1183, and `tests/e2e` at lines 1178-1181 and 1206-1209.
*   **Rationale:** Sort the rows by path so gaps are easier to find.
*   ***AI Suggestion:*** DECLINE
*   ***Justification:*** Sorting the rows does not change what is built. The test rows will be regrouped if the phases are rewritten.
*   ***Depends on:*** None
*   ***Proposed Edit:***
    *   Location: Detailed Implementation Plan and the sections named in the change
    *   Change: None.
