# Goldfish Review Report: Stage 8 Intermediate Zoom Out

**Target:** `/Users/jacob/Development/district-survey/docs/designs/district_survey.md` (lines 1-1441)

**Standard:** `/Users/jacob/.claude/plugins/cache/egm/egm/0.1.1/resources/document_standards/zoom-out-standard.md`

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `egm-zoom-out` | completed |

**Findings:** 4 Blocker, 11 Major, 1 Nit.

Labels such as M4, N7, design-1-2 and comprehension 14 refer to findings in the three earlier reports. "Brief B4" and "brief B5" refer to `concepts_brief.md`.

## Overall Verdict

The core architecture still makes sense: a static site, two separate Lambdas, S3 intake, tag-based routing and date-only answers. The sequencing does not. The earlier fixes should not be applied one at a time, because at least ten pairs conflict or depend on a choice made elsewhere.

Four decisions should come first. Together they settle or substantially narrow about 25 earlier findings.

| Order | Decision | Finding |
| --- | --- | --- |
| 1 | What must be live on opening day | Z1 |
| 2 | How answers reach DistrictStatistics | Z3 |
| 3 | How the site and results are built | Z4 |
| 4 | How a tracked link records completion (also needs the owner's choice on M10) | Z2 |
| 5 | Remaining edits, which become straightforward once the four decisions are made | Z5, Z6, C1-C10 |

## Owner Decisions Reopened

| Finding | Decision affected | What the owner needs to decide |
| --- | --- | --- |
| Z1 | Decision 3 (`concepts_brief.md:398`) | Whether to open without comment boxes if comment review is late. Also confirm the role of DistrictStatistics, which the brief does not record. |
| Z2 | Decision 9a (`concepts_brief.md:405`), in part | Whether tracked adult submissions can stop receiving a receipt. |
| Z3 | Decisions 6 and 9 (`concepts_brief.md:401, 404`) | The change restores these decisions, but the owner must accept the changes to G6, G22 and G25. |
| Z4 | G24, the design choice at line 417, and decision 8 (`concepts_brief.md:403`) | Whether to stop building on the cluster, and whether the deploy pipeline may move to a private repository. |
| Z6, C9 | G26 and the B4 resolution (`concepts_brief.md:102`) | Whether to replace the analyst dashboard, as M18 proposes. |
| C7 | Decision 2 (`concepts_brief.md:397`), in part | Whether hiding a second group is part of the inference risk already accepted. |
| C8 | Decision 9c (`concepts_brief.md:407`) | Whether to accept that a forwarded results link keeps working for up to 7 days. |

## Prioritized Findings (Blockers -> Major -> Nits)

## Blockers

### Z1. DistrictStatistics needs a launch gate and a split scope - Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 20, 25-26, 190-193, 335-337, 1005-1012, 1272-1309
* **Problem:** The design gives DistrictStatistics storage, import, calculations, comment review, staff sign-in and build data. It is step 5 of 6, has no named builder and has no fallback. This extends B1.
* **Rationale:** DistrictStatistics is a CakePHP skeleton with 11 PHP source files and no sign-in or AWS packages. The concepts brief never mentions it, so none of the owner's numbered decisions chose it. The earlier fixes remove about as much work from it as they add (see Z6), so B1 does not get smaller.
* **Recommendation:**
  * Make "DistrictWorkflow and DistrictStatistics running in production with backups, each with a named owner" the first delivery gate.
  * Require import, comment review, staff sign-in and alarms on opening day.
  * Allow the results calculator, results publishing and analyst access to follow after opening. The empty state at lines 650-651 already covers the gap, though its wording needs checking.
  * Agree now what happens if comment review is late. The only safe fallback identified is to open without comment boxes.
* **Owner decision:** Reopens decision 3 temporarily if the fallback is used. The owner should also confirm the role of DistrictStatistics.

### Z2. Use one link record, and stop using receipts in the tracked flow - Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 346-347, 368, 459, 487-492, 514-528, 717-718, 972-973
* **Problem:** Completion depends on the browser carrying a receipt from one Lambda to the other. Most tracked-flow failures come from this.
* **Rationale:** Both Lambdas can already reach the used-records bucket, so the browser does not need to carry this proof.
* **Recommendation:**
  1. The response Lambda saves the answer file first.
  2. It then conditionally creates one empty record named with the link reference.
  3. If that record already exists, it removes the file it just wrote and returns `already_completed`.
  4. Whenever a tracked link opens and the record exists, the tracking Lambda resends the completion message and returns cookies.
  5. Receipts remain only for open-link responses, and always need the person's confirmation.
* **Conditions to add to this proposal (found during consolidation):**
  * Step 3 must delete a file only when this request's own conditional write succeeded. A retry uses the same submission ID, so an unconditional delete could remove the original answer.
  * Step 3 gives the public-facing response Lambda a delete permission on the intake bucket. The current flow at lines 516-525 describes only creating files. Limit this permission as far as possible and cover it in `infra/terraform/tests/iam.tftest.hcl` (line 1152).
  * Comment files are separate and carry no submission ID (line 522), so step 3 cannot find them afterwards. Comments must be written only after the record is claimed, and the design must say how a retry avoids losing or repeating them.
* **Resolves:** M2, M3, M6, design-1-3, design-1-5, and most of design-1-4 and comprehension 14. Partly resolves comprehension 5.
* **What remains:** After a page reload, the person must reopen their email link to finish. A crash followed by a submission from a second device could leave a rare duplicate. The wording at line 20 still needs correcting.
* **Owner decision:** Partly reopens decision 9a, because tracked adult submissions would no longer receive a receipt. This also assumes the optional volunteer step in M10 is removed.

### Z3. Have DistrictStatistics collect answers once a day - Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 23-24, 86-87, 100-101, 147-150, 263-264, 351-353, 367-370, 572-586, 939-940, 971, 1235, 1245, 1434
* **Problem:** M4 and M5 are reported separately, but they are one change to the same pipeline.
* **Rationale:** If DistrictWorkflow never lists or streams answer files, its history cannot tie a named volunteer to a batch. If each batch covers one `submittedOn` date, a batch reveals nothing beyond the date already stored.
* **Recommendation:**
  * DistrictWorkflow triggers the import and receives counts only.
  * DistrictStatistics reads, stores, archives and deletes one completed date at a time.
  * Young people's comments use their own path and shorter schedule, as M1 proposes.
  * Line 370 must say that DistrictStatistics may read upload times during import but must not keep them.
* **Resolves:** M4, M5, design-1-2 and comprehension 6. Also sets the wording needed for M16 and structural-1-4 (see C4).
* **Correction to M4:** Daily import does not change G12. Line 117 says "at most once every 12 hours", and a daily release meets that.
* **Trade-off:** Exact upload times would last about 26 hours in normal running, instead of 12, if the import runs at about 02:00.
* **Owner decision:** Restores decisions 6 and 9. The owner must accept the changes to G6, G22 and G25.

### Z4. Stop building the site and results on the cluster - Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 27, 154-156, 355-357, 417-420, 583, 620-629, 679, 686-687, 943-945, 1092, 1163, 1204, 1237, 1278-1279, 1328
* **Problem:** Cluster builds exist only because survey data and results are reached through private systems. That creates the results exposure, the runner risk and the rollback dependency.
* **Rationale:** Only M13 and M14 applied together remove cluster runners completely. Applying one of them leaves the runner risk in place.
* **Recommendation:**
  * Adopt M13 and M14 together.
  * Serve one public results page containing no figures or question text.
  * Protect a single data path, such as `/results-data/*`, that reads from the private results bucket. This removes the `/results-access*` exception.
  * Keep the survey file, settings and logos in a private repository, and build on GitHub-hosted runners.
  * Do not also apply the site-sync exclusion and build-cache ban in design-1-1, the runner network limits in design-1-16, or the stored release bucket in M15.
* **Resolves:** M13, M14, design-1-1, design-1-16, N1, comprehension 24 and style-1-20. Also resolves most of M15, the author-path part of comprehension 3 and design-1-14, and part of structural-1-9.
* **Owner decision:** Reopens G24 and the design choice at line 417. Decision 8 also reopens if the deploy pipeline moves to the private repository. M14 did not identify this.

## Major

### Z5. Remove the hold-back of individual responses - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 116-117, 597, 609-611, 1295
* **Problem:** M4 proposes choosing held-back responses by keyed hash. A new response could then displace one already published, so figures would change while the shown count stayed at 9. That breaks G12.
* **Rationale:** Published responses must stay published, but storing which release included each response would create another batch label.
* **Recommendation:** Delete the import position and hold-back. Publish a group's new figures only when at least 3 more people have answered since its last release, calculated from all answers and showing the count rounded down to a multiple of 3. `result_releases` already stores the counts used (line 601).
* **Resolves:** Comprehension 8, and the import-position part of M4 and design-1-2. Design-1-20 remains.
* **Owner decision:** None. Decision 2's steps of 3 stay.

### Z6. The combined fixes do not make the plan smaller - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 1014-1328
* **Problem:** The plan has 242 file rows. The Stage 5 correction to "at least 235" was too low. Some rows cover several files.
* **Rationale:** The fixes replace parts more than they remove them. The added-row figures below are estimates.

| Area | Rows removed | Rows added (estimate) |
| --- | --- | --- |
| `district-survey` | 4 (lines 1033, 1035, 1163, 1204) | 1-2 for a test environment |
| DistrictWorkflow | 2 (lines 1235, 1237) | 4-5 for bounces, reminders and health signals |
| DistrictStatistics | 9 (lines 1278, 1279, 1283, 1284, 1287, 1298, 1299, 1305, 1306) | 8 for import, removal, comment list and analyst download |
| Homelab | 1 (line 1328) | 0 |
| New private repository | 0 | About 4 |
| **Total** | **16** | **About 17-19** |

* **Recommendation:** Judge the fixes by parts removed, not rows. They remove the results build pipeline, cluster builds, answers passing through DistrictWorkflow, the dashboard, PHP tag logic and hold-back logic. Merge the requested document additions into six sections: current state, threats and accepted risks, link record states, invitation lifecycle, alarms, and the author's path.
* **Owner decision:** Only through M18, which removes G26.

### C1. A replacement receipt cannot check that the answer exists - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 516-521, 575-580
* **Problem:** Design-1-3 issues a new receipt when "its answer exists". M6 and design-1-4 remove the only value connecting the used record to that answer.
* **Rationale:** Answer files are also deleted after import, so the check could not work later in the survey.
* **Recommendation:** Adopt Z2, where the record is created only after the answer is saved.
* **Owner decision:** Same as Z2.

### C2. Random file names weaken retry protection - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 520-521, 585
* **Problem:** Design-1-2 asks for random names, but a retry must produce the same name for the conditional write to work. M4 Option B proposes a keyed hash instead.
* **Rationale:** DistrictStatistics would reject duplicates later, but the guarantee at line 521 would be lost.
* **Recommendation:** With Z3, keep submission ID names because DistrictWorkflow no longer sees them. Without Z3, use the keyed hash.
* **Owner decision:** None.

### C3. Review tasks cannot be created before deletion under M5 - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 575-586
* **Problem:** M1, style-1-6 and comprehension 10 create tasks before originals are deleted. M5 makes reading, archiving and deletion one DistrictStatistics operation.
* **Rationale:** Task creation should not depend on intake files at all.
* **Recommendation:** On every run, DistrictWorkflow asks DistrictStatistics for comments with no review task and creates the missing tasks.
* **Owner decision:** None.

### C4. The privacy notice cannot be reworded until the schedule is chosen - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 86-87, 99-102, 367, 971
* **Problem:** Structural-1-4 suggests "normally within 12 hours". That would be false under daily import.
* **Rationale:** G9 requires respondent promises to be accurate.
* **Recommendation:** Decide Z3 first, then write one limit that also says faults can extend it.
* **Owner decision:** None beyond Z3.

### C5. Removing both survey-data controllers leaves DistrictStatistics without definitions - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 595, 599, 606, 1278-1279
* **Problem:** M14 removes both controllers, but DistrictStatistics still needs the compiled questions, options and permitted breakdowns.
* **Rationale:** Design-1-14 requires the Lambda and DistrictStatistics to use the same compiled version.
* **Recommendation:** Have the build publish the compiled definition to a private S3 location, identified by its fingerprint. Combine this with M17, so tags arrive in the answer file.
* **Owner decision:** None.

### C6. The existing reminders and bounce queue cannot be reused as proposed - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 983, 1238-1239
* **Problem:** M12 says to reuse the reminder pattern and the bounce queue. The reminder workflow only covers response requests, which decision 9 excludes. The bounce queue is shared with other applications, while brief B5 asks for survey-specific handling.
* **Rationale:** Evidence is at `DistrictWorkflow/docs/reusable-activities.md:288-292, 305-306, 322-324` and `DistrictInfrastructure/modules/transactional-email/README.md:15, 22-25, 30-31`.
* **Recommendation:** Write a survey reminder workflow that copies only the atomic claim method. Have one DistrictWorkflow consumer read the shared queue and filter by sending identity, without discarding other applications' messages.
* **Owner decision:** None.

### C7. Hiding a second group conflicts with "a shown group stays" - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 114-115, 608, 612, 725
* **Problem:** M7 and design-1-12 may hide a group that was previously shown. Line 612 forbids that, and N7 adds a further exception.
* **Rationale:** Hiding figures after publication does not take them back.
* **Recommendation:** Show a breakdown only when every group in it reaches 6. Check the effect against real audience sizes first, because small sections could hide whole breakdowns. Define spam removal as the only reason a shown group can disappear.
* **Owner decision:** Partly reopens decision 2, if this is treated as part of the accepted inference risk.

### C8. The fixes for a leaked results link differ - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 489, 643-644, 647-649
* **Problem:** M11 offers a token ID and block list. Design-1-17 offers a server switch and replacement links. The block list conflicts with "stores nothing" and the agreed token contents.
* **Rationale:** A switch alone does not cancel cookies already issued, which last up to 7 days.
* **Recommendation:** Use the switch, key replacement and replacement emails. Do not add token IDs. State the 7-day limit, and rotate the CloudFront key if immediate cut-off is needed.
* **Owner decision:** Reopens decision 9c, to accept forwarding.

### C9. A cookie-protected analyst page would not meet the sign-in requirement - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 157-159, 653-662
* **Problem:** M18 allows a "protected page or file". Brief B4 requires analyst data to be served only after sign-in, and the emailed results link can be forwarded.
* **Rationale:** Sign-in remains necessary for comment review, so a signed-in download adds little work.
* **Recommendation:** Replace the dashboard with one signed-in download limited to the `survey-analyst` group.
* **Owner decision:** M18 affects G26 and the B4 resolution. This recommendation keeps the sign-in rule in B4.

## Nit

### C10. Accepting an older survey version is unnecessary after a freeze - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 381-384, 478, 567
* **Problem:** Design-1-8 adds a period accepting the previous version and keeps answers that still fit. M8 already prevents minor changes from altering the version.
* **Rationale:** Supporting two live versions adds server and import paths for a rare emergency.
* **Recommendation:** Apply M8 and the freeze. Treat any meaning-changing emergency edit as a manual operator decision.
* **Owner decision:** None.

## Priority Changes to Earlier Findings

| Finding | Was | Should be | Reason |
| --- | --- | --- | --- |
| M5 | Major | Blocker | It is the main fix for Blocker design-1-2. |
| M13 | Major | Blocker | It is the main fix for Blocker design-1-1. |
| Design-1-16 | Major | Closed if Z4 is accepted | Cluster runners are no longer used. |
| M15 | Major | Nit if Z4 is accepted | Only pinning the data version remains. |
| N7 | Nit | Major | CUJ 10 cannot be delivered from the listed files. |
| N3 | Nit | Major | It triggers an irreversible deletion. Keep the email, as brief B4 and stage 7 require (`concepts_brief.md:102, 437`). |
| M20 | Major | Nit | No architecture choice or other fix depends on it. |

## Evidence and Limits

**Confirmed by reading:**
* The plan at lines 1014-1328 has 242 file rows.
* `concepts_brief.md` does not mention DistrictStatistics.
* The state of DistrictStatistics, from `composer.json` and its `src` file list.
* The DistrictWorkflow reminder limits and production status (`DistrictWorkflow/docs/architecture.md:103-104`).
* The shared bounce queue, the optional runner restriction, and `aws s3 sync --delete` at `district-site/.github/workflows/deploy.yml:325`.

**Inferred, not tested:**
* The Z2, Z3, Z4 and Z5 designs are proposals. Nothing was built or run.
* The 26-hour figure assumes an import at about 02:00.
* The added-row figures in Z6 are estimates.
* S3 and CloudFront behaviour rests on general knowledge. Live AWS, GitHub and cluster settings were not inspected.
* `DistrictWorkflow/packages` was outside the supplied context.
