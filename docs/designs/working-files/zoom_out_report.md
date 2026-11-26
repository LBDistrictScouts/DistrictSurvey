# Goldfish Review Report

**Target:** `/Users/jacob/Development/district-survey/docs/designs/district_survey.md` (lines 1-1441; FeatureRange 1-993, DetailedRange 994-1441)

**Stage:** 5, Initial Zoom Out Review

## Reviewer Status

| Reviewer | Status | Findings reported |
| --- | --- | --- |
| `egm-zoom-out` | completed | 1 Blocker, 12 Major, 6 Nit |
| `egm-inventive-catalyst` | completed | 13 Major, 5 Nit (this reviewer does not use the Blocker rating) |

## Summary

| Severity | Findings after merging duplicates |
| --- | --- |
| Blocker | 1 |
| Major | 20 |
| Nit | 8 |
| **Total** | **29** |

The reviewers reported 37 findings. Eight were reported by both reviewers and are merged here. Where the reviewers rated a merged finding differently, this report uses the higher rating and says so.

## Review Limits

- **Restriction breach:** a content search by `egm-inventive-catalyst` across `DistrictStatistics/data-core/config` returned two commented-out placeholder database address lines from `config/.env.example`. The reviewer did not open the file or use those lines. Reviewers were told not to open `.env` files, so this is recorded here.
- **Sampling:** both reviewers read the target and the concepts brief in full, but read only selected files in the larger context paths.
- **Files left unread:** `egm-zoom-out` did not open `DistrictStatistics/data-core/config/app_local.php`, because it may hold credentials.
- **Not checked:** nothing was run and live AWS state was not inspected. `DistrictWorkflow/packages` and the rest of `Homelab` were outside the supplied context. Runner isolation could not be confirmed.
- **Corrections made while merging:**
  - The Blocker's count of file rows is changed from 242 to at least 235, based on a search of the plan's tables.
  - M7 is changed from an exact calculation to a narrow range, because published counts are rounded down to multiples of 3.
  - The Blocker no longer lists the answer-import change as reducing DistrictStatistics work, because that change adds work there.

## Decisions Needed From the Owner

These findings reopen an owner decision or an author decision recorded in the design, or need a choice between two recommendations.

| Finding | Decision affected | Choice needed |
| --- | --- | --- |
| M4 | G12 and G22 12-hour schedule. Upholds owner decision 6 | Import once a day, or keep 12 hours and remove the batch traces |
| M5 | G22, line 939 and the rejection reason for Alternative J. Upholds owner decision 9 | Move answer handling from DistrictWorkflow to DistrictStatistics |
| M7 | Possibly owner decision 2 | Say whether subtraction between groups is part of the inference risk already accepted |
| M10 | **Owner decision 9a** if the optional step is removed | Remove the optional volunteer step, or define it as a separate record |
| M11 | **Owner decision 9c** | Accept forwarding and reword the rule, or add a revocable token ID |
| M13 | G24 | Replace page rebuilds with data files |
| M14 | Design decision at line 417 | Move survey definitions to a private repository |
| M18 | G26 and the brief's B4 resolution | Remove the analyst dashboard from version one |

## Prioritized Findings (Blockers -> Major -> Nits)

## Blocker

### B1. The design depends on two systems that are not ready, and builds them last - Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 190-193, 603-604, 1001, 1005-1012, 1272-1276, 1315-1326
* **Discrepancy Description:** Results, comment review, imports and invitations all need DistrictStatistics and DistrictWorkflow running in production. Who will build that is still an open question, and the delivery order places both at steps 4 and 5. DistrictStatistics is close to the CakePHP starter: it has no sign-in or AWS packages (`DistrictStatistics/data-core/composer.json:7-13`), only fallback routes (`config/routes.php:78`) and one `datasets` table. `DistrictWorkflow/docs/architecture.md:103-104` says production provisioning, credentials and backup policy remain to be done. The brief's stage 0 requires DistrictWorkflow's deployment to be confirmed first (`concepts_brief.md:430`). The plan has at least 235 file rows across several repositories.
* **Rationale & Recommendation:** The largest delivery risk is discovered after the survey-specific work is finished, and there is no fallback if either system is late. Name an owner and a date for both systems before implementation. Make "both running in production with backups" the first delivery step. M13, M14 and M18 would reduce what DistrictStatistics has to provide. M5 would add to it.
* **Reopens an owner decision:** No.

## Major

### M1. A young person's comment can be delayed or never reach a reviewer - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** Lines 128-130, 194-195, 263-264, 575-586, 664-671, 677-678, 697-698, 726, 1146
* **Discrepancy Description:** There are four gaps:
  1. Originals are deleted at step 6, before review tasks are created at step 7. If a run fails between those steps, the next run finds no files and no review task is created. Line 586 says a failed run leaves the files in place, which is not true after step 6.
  2. A comment can wait up to 12 hours only because answers follow that schedule.
  3. G16 requires an alarm when a comment passes its deadline unread, and the brief requires an alarm on the oldest unread comment (`concepts_brief.md:92`). The alarm list at lines 697-698 has neither.
  4. Escalation runs on the same cluster as DistrictStatistics, so a cluster outage stops the review, the escalation and the alert together. The deputy depends on the same systems.
* **Rationale & Recommendation:** This is the path where a late or lost item does the most harm.
  - Import young people's comments on their own short schedule, from their own S3 location.
  - Keep adult comments on the slower schedule, because a fast review task for a tracked adult could be matched to their completion time.
  - Create review tasks from a DistrictStatistics list of comments that have no task yet, and do this before deleting originals.
  - Add the unread-comment alarm and include it in the alarm drill.
  - Send a regular heartbeat from DistrictWorkflow to CloudWatch, and treat missing data as a fault.
* **Reopens an owner decision:** No. It answers the open question at line 194.

### M2. A volunteer can become permanently unable to complete their task - Severity: Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 459, 514-528, 717
* **Discrepancy Description:** Only the response Lambda knows that a link has been used to submit. The tracking Lambda learns this when the browser presents a receipt. If the receipt is lost through a second device, cleared storage or a closed private tab, the tracking Lambda still treats the link as unused and issues a new pass. The person answers everything again and then receives `already_completed` with no receipt.
* **Rationale & Recommendation:** The task never completes, reminders continue and the volunteer never gets results access. Let the response Lambda answer a valid pass for an already-claimed link with a new receipt tied to that link reference. Make this check when the page opens, before any questions appear. This adds one call on page open and a second receipt format.
* **Reopens an owner decision:** No.

### M3. A failed queue send can lose a completion for good - Severity: Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 459, 509-510, 524-525, 718-719
* **Discrepancy Description:** The tracking Lambda writes its used records before sending the SQS message. If the send fails and the browser never retries, the link looks completed. Later opens return cookies, and nothing sends the message again.
* **Rationale & Recommendation:** The order protects against duplicate messages, which line 719 says are harmless, at the cost of lost messages, which are not. Claim the receipt, send the message, then write the used-link record last. Also resend the message whenever a completed link is opened before the survey closes.
* **Reopens an owner decision:** No.

### M4. Batch archives and import positions recreate the batch label the owner ruled out - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** Lines 86-87, 147-153, 198, 520, 572-580, 596-597, 610-611, 793, 832-833, 976
* **Discrepancy Description:** Owner decision 6 allows "no time of day and no batch label" and says completion times cannot be matched "more closely than the day" (`concepts_brief.md:401`). The design leaves three batch traces:
  - Each 12-hour import creates its own archive.
  - Temporal run history lists file names, and those names are submission IDs.
  - The shuffled import position appears to rise from batch to batch, because line 610 uses it to find the "newest" responses. Combined with batch counts, position ranges reveal each response's batch.
* **Rationale & Recommendation:** Shuffling hides order inside a batch, but not which batch a response belongs to. On a quiet day, a 12-hour window may contain one tracked volunteer, and archive retention is undecided. There are two ways to fix this:
  - **Option A:** import and archive answers once a day, after midnight, so a batch reveals only the date already stored in `submittedOn`. This changes G12, G22 and the 12-hour wording in G6 and G25.
  - **Option B:** keep the 12-hour import, archive by `submittedOn` date by rewriting that day's file, and name intake files with a keyed hash.

  With either option, remove the rising position. Choose held-back responses using a keyed hash of the submission ID.
* **Reopens an owner decision:** It upholds decision 6. Option A changes the 12-hour schedule in G12 and G22.

### M5. Answers pass through DistrictWorkflow, the system that holds identities - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** Lines 147-150, 171, 369, 575-580, 677, 816-817, 939-940, 1145, 1235, 1272, 1290
* **Discrepancy Description:** Owner decision 9 says "Survey answers never enter DistrictWorkflow" (`concepts_brief.md:404`). The design weakens this to "never stored" (line 150) and allows answer files to be streamed through it (line 369). DistrictWorkflow also holds named completion times and can read each file's exact upload time, so it is the one system able to join identity to answers.
* **Rationale & Recommendation:** DistrictStatistics already calls S3 and has its own AWS identity (lines 677, 1145), so this extra step is not needed. Have the DistrictWorkflow schedule call one DistrictStatistics endpoint. DistrictStatistics then reads the files, stores them, writes and verifies the shuffled archive, and deletes the originals. DistrictWorkflow keeps scheduling, retries and review tasks, and receives counts only. DistrictStatistics will need intake read and delete rights and a background import job with status checks.
* **Reopens an owner decision:** It restores decision 9. It reopens G22, line 939 and the stated reason for rejecting Alternative J.

### M6. The used-pass record is a lasting link between a person's link and their answers - Severity: Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 83-85, 368, 516-519, 972
* **Discrepancy Description:** The record is named from the link reference and contains an HMAC of the link reference and submission ID. The submission ID is stored with the answers, so anyone holding the keys can test which link produced which response until the record is deleted after close. Owner decision 9a says used records hold "no date or response ID" (`concepts_brief.md:405`). S3 also adds an exact creation time to every record.
* **Rationale & Recommendation:** The record only needs to recognise a retry, which does not need the submission ID. Have the browser generate a separate random retry secret, kept with the draft and never written to the answer file, and store only a hash of that secret. Correct the "no date" wording to acknowledge S3's timestamp.
* **Reopens an owner decision:** No. It enforces decision 9a.

### M7. A hidden group's size can be estimated by subtraction - Severity: Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 114-115, 606-612, 660-661
* **Discrepancy Description:** Hiding one small group does not fully protect it if the total and the other groups are shown. For example, with a published total of 12 and Group A at 9, a hidden Group B must be small. Rounding down to multiples of 3 means the result is a narrow range and not an exact number. Lines 608-612 check each group separately and have no rule for the remainder. The brief's B1 raised subtraction between groups (`concepts_brief.md:84`).
* **Rationale & Recommendation:** The published figures weaken the minimum that G11 sets. Add an automatic release check: when the hidden remainder could be between 1 and 5, hide another group or the whole breakdown. Cover this with the shared golden files. Small sections will see fewer breakdowns.
* **Reopens an owner decision:** Partly. It challenges decision 2 if the owner regards this as part of the inference risk already accepted. Otherwise it is a defect against G11.

### M8. A small survey change can wipe respondents' answers - Severity: Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 71-73, 381-384, 424-425, 478, 567
* **Discrepancy Description:** The fingerprint covers the compiled definition, and the opening and closing dates are part of the survey file. Nothing excludes them, so extending the closing date or fixing a typo appears to change the version. Drafts are discarded when the version changes. The brief's B6 asked for a freeze at opening with a listed set of minor fixes (`concepts_brief.md:112`), and the design has neither.
* **Rationale & Recommendation:** Someone could finish a long survey and lose it at submission, which conflicts with G3. Fingerprint only what affects meaning: question IDs, options and routing. Keep dates and approved wording fixes in separate settings, and freeze the fingerprint at opening.
* **Reopens an owner decision:** No.

### M9. An open-link flood can still block tracked volunteers after the operator responds - Severity: Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 295-300, 458, 725, 963, 1109
* **Discrepancy Description:** Open and tracked submissions share one route, one throttle and one Lambda. The close switch runs inside the Lambda, so flood traffic still uses that capacity after open submissions are closed. The design does not say where the switch is stored or how it is operated. The brief's M5 asked for separate limits (`concepts_brief.md:158-159`).
* **Rationale & Recommendation:** CUJ 10 promises "Tracked links keep working", which cannot hold under the load it describes. Use separate open and tracked routes with their own limits, and block the open route at CloudFront or API Gateway when closed. Define where the switch is stored and how quickly it takes effect.
* **Reopens an owner decision:** No.

### M10. The optional volunteer follow-up conflicts with the validation rules - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** Lines 88-93, 240, 409-413, 552-555
* **Discrepancy Description:** CUJ 2 says no second response is created, but lines 554-555 let the same person submit volunteer questions as a partial response. A partial submission has no `age-group` or `adult-roles` answers, so the route check at lines 412-413 would reject it. If it were accepted, one person could be counted twice.
* **Rationale & Recommendation:** The feature cannot be built as written. The reviewers recommend different fixes, so the owner needs to choose:
  - **Remove it (`egm-zoom-out`):** completing the tracked link with the receipt is enough for version one.
  - **Define it (`egm-inventive-catalyst`):** create a separate supplement record that may contain only volunteer-only questions and has its own route check. Reword CUJ 2 and G8 to allow it. This adds a file format, an import rule and tests.
* **Reopens an owner decision:** **Removing it reopens decision 9a.** Defining it implements decision 9a.

### M11. The results link does not enforce "only people with a completed tracked link" - Severity: Major
* **Reviewer Lens:** `egm-zoom-out` (Major), `egm-inventive-catalyst` (Nit)
* **Affected Scope:** Lines 108-113, 489, 647-649, 850-855
* **Discrepancy Description:** G10 says only a person with a completed tracked link can see results, but line 649 accepts that anyone sent the email can view them. The token holds only the survey ID, access level and expiry, so every recipient's token carries the same contents. One leaked link can be stopped only by replacing the key, which cuts off everyone.
* **Rationale & Recommendation:** Alternative O was rejected because anyone who finds the address can view results, and the emailed link has much the same weakness. Reword G10 to describe what is enforced, record the forwarding risk as accepted, add a key-replacement step to the operations guide, and update the reason for rejecting Alternative O. If the owner wants to be able to cancel a single link, add a random token ID that is not recorded against any person, plus a small block list.
* **Reopens an owner decision:** **Yes, decision 9c.** Rewording changes "only people with a completed tracked link". A token ID also changes the agreed token contents. Signed cookies stay.

### M12. The invitation and reminder journey is barely designed - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 43-44, 190-191, 438-450, 717, 1238-1239, 1246
* **Discrepancy Description:** Tracking who has responded is a main reason for building the tool, yet the design covers little beyond the link format. It does not define reminder timing or limits, bounced emails, reissued links, late additions or a test send. The brief's B5 and M14 asked for these (`concepts_brief.md:107, 205`). DistrictWorkflow already has a reminder pattern (`DistrictWorkflow/docs/reusable-activities.md:298-309`). A shared bounce queue exists with no consumer (`DistrictInfrastructure/modules/transactional-email/README.md:23-31`), and the plan lists no file that reads it.
* **Rationale & Recommendation:** Without bounce handling, a volunteer who never received the email looks like one who ignored it, and completion figures are wrong. Add a short section covering the journey from import to close. Reuse the reminder claim pattern and the existing bounce queue.
* **Reopens an owner decision:** No.

### M13. The results rebuild pipeline adds risk that serving data files would avoid - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** Lines 27, 154-156, 355-357, 583, 618-624, 943-944, 964-965, 1046, 1163, 1237
* **Discrepancy Description:** Each results change starts a build in a public repository on a cluster runner, then uploads pages to the site bucket, even though DistrictStatistics already writes the same figures as JSON to a private results bucket. Three problems follow:
  - The site deploy uses `aws s3 sync --delete` (`district-site/.github/workflows/deploy.yml:325`), and the brief warned that this pattern loses results kept in a site bucket (`concepts_brief.md:148`). The design does not say how a site deploy or rollback keeps the results files.
  - Only results files are uploaded (line 623), but those pages depend on hashed script and style files from the same build. Those files may not exist in the site bucket.
  - Page data supplied at build time can end up in `/_next/static` files, outside the `/results*` protection.
* **Rationale & Recommendation:** The numbers change, but the page does not need to. Deploy one static results page. Have DistrictStatistics write versioned JSON and a short-lived pointer file to the results bucket, as the brief proposed at line 149, and serve them through CloudFront under the same signed cookies. Rollback then means changing the pointer. Results will need JavaScript to display, and CloudFront will need a second origin.
* **Reopens an owner decision:** Not a numbered decision. It replaces G24's GitHub Action and supports decision 7's separate private results bucket. Signed cookies stay.

### M14. Storing survey definitions in DistrictStatistics forces a public repository onto private cluster runners - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 31, 139-140, 288-293, 417-420, 620-621, 679, 943-945, 999, 1092, 1162-1163, 1278-1279
* **Discrepancy Description:** The real survey, settings and logos live on a private-network application, so builds must run on cluster runners. The design describes "one survey file" (line 31) but stores definitions in a database (line 417), and no listed file or screen uploads them. The build-data call names no credential (line 418), while `district-site` passes a username and password (`deploy.yml:91-93`). Line 945 says the runner group allows only approved repositories, but the runner README treats that restriction as optional (`Homelab/K8S/GitHubActionsRunnersLBDistrictScouts/README.md:30-32`).
* **Rationale & Recommendation:** A public repository using runners inside the private network carries avoidable risk, and survey authoring has no complete path. Keep the survey file, settings and logos in a small private repository, as the brief's B10 proposed (`concepts_brief.md:132`). Build on GitHub-hosted runners with short-lived credentials, and remove the two survey-data controllers and the cluster runner dependency.
* **Reopens an owner decision:** Yes, the design decision at line 417. It does not reopen a numbered decision.

### M15. Rollback depends on the home cluster and does not restore the same survey - Severity: Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 417-420, 679, 721-722, 963-965, 1162
* **Discrepancy Description:** Rolling back means rebuilding an old tag on the cluster runner, which reads current data from DistrictStatistics. If the cluster is down, rollback is not possible. If survey data has changed, the rebuilt site differs from the original and may trigger the draft loss in M8. Line 418 selects build data by `SURVEY_ID` only, with no pinned version.
* **Rationale & Recommendation:** The live survey is designed to survive a cluster outage, but its repair path is not. Store each release's built site and Lambda packages in a private S3 location, so rollback copies a stored release and needs no build. These files must not be GitHub artifacts, because the repository is public (line 621).
* **Reopens an owner decision:** No.

### M16. The public "up to 12 hours" statement cannot always be true - Severity: Major
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 85-87, 99-102, 367, 575, 721-722, 971
* **Discrepancy Description:** G6, G25 and line 367 state a flat 12-hour limit. A file uploaded just after a run starts waits for the whole interval plus the next run's duration. Batch size limits and outages extend this further, as line 971 admits.
* **Rationale & Recommendation:** This wording goes into the privacy notice, so it must be accurate. Change the notice to a limit the system can meet, and state that faults can extend it. Raise an alarm when the import heartbeat from M1 stops. The data protection assessment must reflect the new wording.
* **Reopens an owner decision:** No.

### M17. Tag logic is written a second time in PHP - Severity: Major
* **Reviewer Lens:** `egm-zoom-out` (Major), `egm-inventive-catalyst` (Nit)
* **Affected Scope:** Lines 409-413, 530-541, 599, 822-824, 1201, 1302
* **Discrepancy Description:** DistrictStatistics recalculates reporting tags from the survey definition, so `evaluateSurvey` needs a PHP equivalent and shared golden files to keep the two in step. Alternative K was rejected partly because it "needs the question logic rewritten in PHP".
* **Rationale & Recommendation:** Two versions can drift apart, and a difference would silently change reported results and minimum group checks. The preferred fix is for the response Lambda to write its calculated reporting tags into the answer file and for DistrictStatistics to store them, with the field added to the approved list in G6. A smaller alternative is for the compiler to output a flat table of options and tags, so PHP only looks values up.
* **Reopens an owner decision:** No. Decision 10 already has the server calculate tags.

### M18. The analyst dashboard largely repeats the published results - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 157-159, 310-316, 653-662, 1283-1287, 1298-1299
* **Discrepancy Description:** The dashboard reads only from `result_releases`, so analysts see figures that have already been published. It still needs its own access group, screens, downloads, audit log and tests.
* **Rationale & Recommendation:** Nothing in the design shows a need that a protected page or a download of the release file could not meet. Remove G26 and CUJ 12 from version one, and give analysts the release figures as a protected page or file. Add a dashboard later if a real need appears.
* **Reopens an owner decision:** Partly. It removes G26 and changes how the brief's B4 resolution, "Serve analyst data only after sign-in", is met (`concepts_brief.md:102`).

### M19. The promise that other districts can run their own copy is not yet true - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 31-33, 141-143, 201-202, 989, 1205
* **Discrepancy Description:** The overview says other districts can run their own copy, but the tool needs DistrictWorkflow and DistrictStatistics, and what replaces them is an open question.
* **Rationale & Recommendation:** Readers could rely on a goal that version one cannot meet. Keep publishing the code. Reword the overview and G20 to say that the code is public, contains no district values and currently needs both systems. Leave adapters as future work.
* **Reopens an owner decision:** No. The MIT publishing goal stays.

### M20. The test programme is too large for a once-a-year volunteer tool - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 1332-1333, 1337-1362
* **Discrepancy Description:** The plan requires mutation testing, 100% coverage in places, three browser engines on every pull request, two accessibility tools and two PHP static analysers.
* **Rationale & Recommendation:** Volunteers must maintain all of this, pull requests will be slow, and several tools overlap. Keep the targeted tests for stored fields, logging, routing, signing, access and alarms. Remove Stryker, Psalm and pa11y-ci. Run the full browser set before release and not on every pull request. Set one lower coverage target, with higher targets only for the survey engine and signing code.
* **Reopens an owner decision:** No.

## Nit

### N1. The protected results path is written two ways - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** Lines 626, 645, 686-687, 1024, 1150
* **Discrepancy Description:** Line 626 protects `/results*`, but line 687 says `/results/*`. The second pattern does not match `/results` or `/results.html`, and the rewrite serves `/results.html` (`DistrictInfrastructure/modules/cloudfront-distribution/clean-urls.js:9-16`).
* **Rationale & Recommendation:** If line 687 were followed, the results page could be reached without cookies. Use `/results*` throughout, and test `/results`, `/results/` and `/results.html` on the deployed site. Consider renaming `/results-access` so it no longer needs a higher-priority exception.
* **Reopens an owner decision:** No.

### N2. Certificate ownership is stated two ways - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 702-704, 1138
* **Discrepancy Description:** The root Terraform passes a certificate in, but the module also creates one.
* **Rationale & Recommendation:** Choose one. Passing it in can reuse `DistrictInfrastructure/modules/certificates`.
* **Reopens an owner decision:** No.

### N3. A "final results email" appears without a definition - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 110-112, 231-232, 974, 1238, 1261
* **Discrepancy Description:** The goals and journeys describe one thank-you email, but the retention table and the plan depend on a separate final results email.
* **Rationale & Recommendation:** Define when it is sent and to whom, or remove it and set a different trigger for deleting invite UUIDs.
* **Reopens an owner decision:** No.

### N4. "One email" cannot be guaranteed - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 633-634, 719, 1242
* **Discrepancy Description:** DistrictWorkflow's email activity can send a duplicate after a crash (`DistrictWorkflow/docs/reusable-activities.md:55-57`).
* **Rationale & Recommendation:** Say that repeat completion messages do not trigger another email, and that a rare duplicate is possible after a failure.
* **Reopens an owner decision:** No.

### N5. The retention table leaves out Temporal history - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 148-149, 967-977, 1244
* **Discrepancy Description:** If the completion intake follows the existing queue pattern, invite UUIDs will appear in Temporal history (`DistrictWorkflow/apps/worker/src/workflows/activity-notification.ts:15-18`). They could outlast the deletion at line 974.
* **Rationale & Recommendation:** Add Temporal history to the retention table and include it in the deletion check.
* **Reopens an owner decision:** No.

### N6. One planning assumption is too broad - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Line 1003
* **Discrepancy Description:** The design says other open questions become settings and do not change the code structure. Several would change it, including adult comments, comment timing, comment approval and Young Leader questions.
* **Rationale & Recommendation:** List which open questions must be answered before building, and which can remain as settings.
* **Reopens an owner decision:** No.

### N7. Spam removal has no owner in the build plan and conflicts with a results rule - Severity: Nit
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 299-300, 612, 725, 1260, 1278-1293
* **Discrepancy Description:** Line 612 says a shown group stays shown, but removing spam can take it below 6. The DistrictStatistics file list has no component that removes responses, and only a DistrictWorkflow test covers it.
* **Rationale & Recommendation:** CUJ 10 cannot be delivered from the listed files. Add a removal service with an audit entry, and state that a group is hidden again if removal takes it below the minimum.
* **Reopens an owner decision:** No.

### N8. Tracked and open links share one page, which weakens the browser security rule - Severity: Nit
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** Lines 444, 694-695, 946-947, 1045
* **Discrepancy Description:** Tracked pages must load no third-party script, but both link types use `/survey`. A security header set per path must therefore allow Turnstile on tracked pages too.
* **Rationale & Recommendation:** The rule rests on page code alone, with no browser enforcement. Give tracked links their own path with a stricter policy.
* **Reopens an owner decision:** No.
