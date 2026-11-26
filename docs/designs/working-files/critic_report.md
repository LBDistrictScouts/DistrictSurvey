# Goldfish Review Report

**Target:** `/Users/jacob/Development/district-survey/docs/designs/district_survey.md` (lines 1-993, up to the heading "Detailed Implementation Plan")

**Stage:** 7 (Critic Review), round 1

## Reviewer Status

| Reviewer | Status | Standard | Raw findings (Blocker / Major / Nit) |
| --- | --- | --- | --- |
| `egm:egm-design` | completed | `feature-spec-standard.md` | 3 / 16 / 4 |
| `egm:egm-structural` | completed | `feature-spec-standard.md` | 1 / 8 / 6 |
| `egm:egm-style` | completed | None | 0 / 13 / 9 |

## Summary

| Severity | Findings after merging duplicates |
| --- | --- |
| Blocker | 3 |
| Major | 26 |
| Nit | 14 |
| **Total** | **43** (from 60 raw findings) |

The three Blockers are:

1. Results pages can be left unprotected or deleted.
2. Workflow history can tie a named volunteer to a small batch of answers.
3. A saved response can leave a volunteer's task open with no way to finish it.

### Findings that affect owner decisions

| Finding | Decision | Effect |
| --- | --- | --- |
| structural-1-7 | 7, 9 and 9c | **Reopens.** The design already differs from these decisions, so the owner needs to confirm or reverse each change. |
| design-1-17 | 9c | **Partly reopens.** The owner needs to confirm that forwarded links are an accepted exception to "only people with a completed tracked link". |
| design-1-6 | 9a | **Reopens only if** the optional volunteer step is removed instead of being defined. |

design-1-1 and design-1-2 bring the design back in line with decisions 7 and 6. They do not reopen them.

### Review limits

- **Access-limit breach:** one `egm:egm-design` search of `DistrictStatistics/data-core` did not exclude `.env*` files. It searched `config/.env.example` and returned two commented-out placeholder database URL lines (36 and 37). The reviewer reports that they were example values and that no finding uses them. The values are not repeated here.
- **File names only:** an `egm:egm-style` file listing of `DistrictStatistics/data-core` showed `vendor` paths. The reviewer did not open or search those files.
- **Not checked:** nothing was deployed or run. Live AWS, Cloudflare, Kubernetes and GitHub organisation settings were not checked, and neither were the runner's Helm values.
- **Next.js output:** `node_modules` was off limits, so the export file names in design-1-1 rest on general knowledge of Next.js. Test them against a real build.

### Severity decisions

Where reviewers rated the same issue differently:

- **structural-1-1** is rated Major. Structural proposed Blocker and Design proposed Major. The standard requires this content, but much of it exists elsewhere in the document, and adding it changes no part of the design.
- **design-1-1** is rated Blocker. Design proposed Blocker, Structural proposed Major and Style proposed Nit for parts of the same issue. Design's wider finding shows that results can be exposed.

## Prioritized Findings (Blockers -> Major -> Nits)

## Blocker

### design-1-1: Results protection has gaps, and a site deploy can delete results - Severity: Blocker
* **Reviewer Lens:** `egm-design`, `egm-structural`, `egm-style` (merges structural-1-6 and style-1-19)
* **Affected Scope:** Lines 108-113, 620-629, 645, 686-687
* **Discrepancy Description:**
  * Line 626 protects `/results*`, but line 687 lists the CloudFront rule as `/results/*`. The second pattern does not match `/results` or `/results.html`. Line 687 also leaves out the `/results-access*` rule.
  * Line 623 uploads "only the exported results files". Those pages also need build files under `/_next/static/`, which is outside the protected path. If the files are missing, the pages break. If they are uploaded and contain results data, that data is public.
  * Results pages share the site bucket, and the design does not say how a site deploy or rollback keeps them. The district site's deploy uses `aws s3 sync --delete` (`district-site/.github/workflows/deploy.yml:325`). The same pattern here would delete the results pages.
* **Rationale & Recommendation:** G10 depends on these rules, and CloudFront is the only barrier around results. Give one rule table, in priority order, with exact paths and one results address. Serve results assets from under the protected path, or use a separate protected origin as decision 7 describes. Exclude results from site deploy deletion. Add a post-deploy test that requests every results file without cookies and expects a 403 response. Ban build caches that contain results.
* **Reopens an owner decision:** No. It restores decision 7.

### design-1-2: Workflow history can tie a named volunteer to a small batch of answers - Severity: Blocker
* **Reviewer Lens:** `egm-design`, `egm-style` (merges style-1-5)
* **Affected Scope:** Lines 83-87, 147-150, 369, 520-521, 572-573, 597, 610-611, 792-793
* **Discrepancy Description:**
  * Answer files are named with the submission ID (line 520), and workflow inputs and outputs hold file names (lines 572-573). DistrictWorkflow's run history therefore records which submission IDs were in each 12-hour batch.
  * DistrictWorkflow also knows when each named volunteer completed, and DistrictStatistics stores the submission ID beside the answers (line 597). In a quiet period, one tracked completion and one tracked file in a batch identify that person's answers. This link lasts as long as the workflow history does.
  * The "shuffled import position" appears to keep batch order, because line 610 uses it to find the "newest" responses. With two runs a day, it acts as a batch label.
  * During the intake window, DistrictWorkflow's import role can read exact upload times in the same system that holds identities.
* **Rationale & Recommendation:** Decision 6 requires "no batch label" and says completion times cannot be matched to a response more closely than the day. The design does not meet that rule or the promise in G9. Use random object names unrelated to the submission ID. Keep object names out of workflow inputs, outputs and activity results, and pass only a batch ID. Remove any stored value that shows import order, and define "newest" without it. Restrict who can use the import role, and state the exposure that remains.
* **Reopens an owner decision:** No. It enforces decision 6.

### design-1-3: A saved tracked response can leave the task open with no way to finish - Severity: Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 448-450, 459, 514-528, 564, 716-718
* **Discrepancy Description:**
  * **Lost receipt:** if the pass is claimed but the receipt never reaches storage, or the person changes device, the link still counts as unused. A new pass is issued, a new submission ID returns `already_completed`, and no receipt is returned. The task cannot complete, reminders continue and results stay locked. If the Lambda stops between claiming the pass (step 2) and saving the answers (step 3), no answer exists either.
  * **Queue failure:** used records are written before the SQS send (lines 509-510). Line 718 says the browser retries, but the design does not say a retry resends the message once those records exist. Line 459 treats a used link as completed, so the message may never be sent.
  * **Page reload:** the invite link is held only in memory (line 449), but step 6 needs it. After a reload or a resumed draft, the person can submit but the link cannot complete until they reopen the email.
* **Rationale & Recommendation:** G5, CUJ 1 and CUJ 8 all require the task to complete, and completion tracking is a main reason for building this tool. Add a state table covering each crash point. Make the claim recoverable, or save the answer before the claim becomes final. Return a new receipt when a pass is already claimed and its answer exists. Make completion repeatable, so a matching retry always resends the message. Tell the person to reopen their email link when the invite link is missing.
* **Reopens an owner decision:** No.

## Major

### Privacy and access

### design-1-4: Used-pass records allow answers to be linked back to a tracked link - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-style` (merges style-1-4)
* **Affected Scope:** Lines 19-20, 332-333, 365, 368, 487, 491-492, 516-519, 972
* **Discrepancy Description:** Each used-pass record is named from the link reference and contains a one-way value (HMAC) of the link reference and submission ID. Someone with the keys, the UUID list and the stored submission IDs can test the pairs and recover who gave which answers. The response Lambda also receives a stable link reference with the answers, although line 20 says "Neither sees the other's data". Line 517 does not say which key the second HMAC uses, and the retention table gives no deletion date for the keys.
* **Rationale & Recommendation:** The design creates this link, and it can be avoided. Have the browser generate a random retry secret and store only its hash in the used-pass record. Do not derive that value from the submission ID. Destroy the HMAC keys at close, name who holds each key, and correct line 20.
* **Reopens an owner decision:** No.

### design-1-5: A leftover receipt can complete another person's task on a shared device - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 244-249, 488, 527-528, 552-553
* **Discrepancy Description:** Line 527 completes a link from a stored receipt "with no further questions", while line 552 requires the person to confirm first. A receipt does not record its source or its link (line 488). If one volunteer's completion is interrupted, a second volunteer on that device could have their task completed without answering.
* **Rationale & Recommendation:** This breaks CUJ 3 and creates false completion records. Store unfinished tracked receipts against a one-way value of that link. Skip the question only on an exact match, and ask in every other case.
* **Reopens an owner decision:** No.

### design-1-12: Hidden groups can be worked out by subtraction - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 114-115, 606-613, 725
* **Discrepancy Description:** If a question total is shown with all but one breakdown group, the hidden group's figures can be calculated by subtraction. Rounding each group down separately also makes totals inconsistent. Line 612 keeps a shown group in later releases, but spam removal (line 725) could take that group below 6.
* **Rationale & Recommendation:** Decision 2 accepts inference from release steps, but it keeps the minimum of 6 for each group (G11). Hide a second group, or the total, when only one group would be hidden. Define what happens when counts fall. Test the rules against consecutive releases.
* **Reopens an owner decision:** No.

### design-1-13: Tracked and open comparisons can expose role combinations - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 166-167, 612, 659-661
* **Discrepancy Description:** The dashboard offers tracked and open comparisons, but tracked links go only to volunteers. A "tracked parents" figure therefore describes people who are both parents and volunteers. Line 612 says reporting never combines roles.
* **Rationale & Recommendation:** The dashboard contradicts the design's own reporting rule, and `concepts_brief.md:229-230` (M19) identified this risk. List every permitted dashboard view. Allow source comparison only where it cannot reveal a role combination.
* **Reopens an owner decision:** No.

### design-1-17: Results access is overstated, and a leaked link cannot be withdrawn - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-structural`, `egm-style` (merges structural-1-8 and style-1-2)
* **Affected Scope:** Lines 108-113, 157-159, 489, 647-650, 853-854
* **Discrepancy Description:** G10 says "Only a person with a completed tracked link can see results". Lines 648-649 say anyone the email is forwarded to can view them, and G26 gives named analysts access. Every token carries the same details and lasts until 3 months after close, and there is no way to withdraw access if a link is posted publicly. Alternative O is marked down because anyone who finds the address can view results, but the chosen link has a similar weakness that is not compared.
* **Rationale & Recommendation:** G10 cannot be tested as written, and an operator has no response to a leak. Reword G10 to say access is issued only to people who complete a tracked link, that a forwarded link also grants access, and that analysts are a separate case. Add a server switch that stops issuing cookies, and define how replacement links are sent. Address the forwarding weakness in Alternative O.
* **Reopens an owner decision:** Partly, decision 9c. The owner needs to confirm the forwarding exception. If forwarding must be blocked, the mechanism in 9c needs revisiting.

### structural-1-4: The 12-hour limit on exact upload times is not a firm limit - Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-style`, `egm-design` (merges style-1-1)
* **Affected Scope:** Lines 85-87, 99-104, 367, 575, 586, 708, 721-723, 971
* **Discrepancy Description:** G6, the G25 privacy notice and the visibility table give 12 hours as a limit. Each run takes only "a fixed batch size" (line 575), and failed runs and outages keep the files for longer (lines 586, 721-723). Only line 971 allows for a longer wait, and it does not cover a backlog. The design also does not say whether log timestamps count as an exact time (line 708). The young people's notice makes a different promise from the adult notice: "what you said", not "who gave which answers".
* **Rationale & Recommendation:** G25 is shown to respondents, including children, and G9 requires promises to be accurate. Use one rule everywhere, such as "normally within 12 hours, and longer if a technical fault delays processing", or set a hard maximum and say what happens when it is reached. Cover backlogs, state how log timestamps are treated, and align the two notices.
* **Reopens an owner decision:** No.

### style-1-3: "Anonymous" and "nothing that identifies them" claim too much - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 29, 56-58, 270-271, 367, 370
* **Discrepancy Description:** Line 57 says "Responses are anonymous, so if a young person discloses harm in a comment, nobody can identify them". Line 271 says "nothing that identifies them is stored". A comment can contain a name or identifying details, as contradiction 4 in the concepts brief recognises. Line 370 says DistrictStatistics must never hold names, but it stores comment text.
* **Rationale & Recommendation:** This matters for safeguarding, because a reviewer may be able to identify a child from what they wrote. Say "The survey does not ask for names or collect contact details. A comment may still contain identifying details that the writer enters." State what a reviewer does in that case.
* **Reopens an owner decision:** No.

### design-1-16: Public-repository builds run inside the cluster that holds private data - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 417-420, 620-624, 677-679, 943-945
* **Discrepancy Description:** Trigger rules limit which jobs start, but they do not contain a compromised build dependency. Such a job would run on the same cluster as DistrictStatistics and DistrictWorkflow. The design defines no network limits for the runners and no credential for the build-data API. Line 945 states that runner access is restricted, but `Homelab/K8S/GitHubActionsRunnersLBDistrictScouts/README.md:30-32` describes that restriction as optional.
* **Rationale & Recommendation:** DistrictStatistics will hold children's answers and comments. Allow runner traffic only to the build-data endpoint and required outbound services. Use a read-only credential limited to build data. Make the runner-group setting and these limits launch checks.
* **Reopens an owner decision:** No.

### structural-1-9: District-specific details conflict with G20 - Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-style` (merges style-1-7)
* **Affected Scope:** Lines 11, 13, 31-33, 141-143, 201-202, 419-420, 620-621, 673-680, 943, 982-984, 989
* **Discrepancy Description:** G20 says no district-specific values appear in the public code, and line 943 says this repository is public. The committed design names the district's runner group and private sibling repositories, and it describes the private network layout. Line 620 also places the runner name in the public Action. Lines 32-33 present reuse by other districts as an outcome, but line 201 leaves open what those districts would use in place of DistrictWorkflow and DistrictStatistics.
* **Rationale & Recommendation:** The network details describe private infrastructure in a public location, and G20 fails on the design's own runner name. Move district-specific design to the private district layer, or narrow G20 to exclude documents and remove the network detail. Make the runner name a repository setting. Say that other districts will need replacements for the two systems.
* **Reopens an owner decision:** No.

### Reliability and abuse

### design-1-8: A live survey change can discard respondents' answers - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 71-73, 476-478, 567
* **Discrepancy Description:** Drafts are discarded whenever the survey version changes, and the server can reject a submission with `version_changed`. A typo fix during the survey could wipe every draft or reject someone who has just finished.
* **Rationale & Recommendation:** This conflicts with G3, and the survey runs for about a month. `concepts_brief.md:112` (B6) asks for the version to be frozen at opening. Freeze the survey at opening, define an emergency change process, accept the previous version for a set period, and keep answers that still fit the new version.
* **Reopens an owner decision:** No.

### design-1-9: An open-link retry may fail Turnstile - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 281-286, 463-474, 549, 716
* **Discrepancy Description:** A retry reuses the submission ID, but the design does not say it obtains a new Turnstile token. Tokens are normally single-use, so a retry after a lost reply could return `verification_failed`. The order of the Turnstile check and the duplicate check is also undefined.
* **Rationale & Recommendation:** CUJ 8 would fail for open-link users, and `concepts_brief.md:164` (M6) requires a new check on each retry. Get a new token for each attempt, keep the answers in the browser, and add a test that loses the reply after a successful save.
* **Reopens an owner decision:** No.

### design-1-10: Open-link abuse can block tracked volunteers, and the API can be called directly - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 295-300, 454-458, 697, 953
* **Discrepancy Description:** Open and tracked submissions share `POST /api/v1/responses`, so route limits cannot separate them. Nothing blocks direct calls to the API Gateway address, and there is no limit per connection.
* **Rationale & Recommendation:** CUJ 10 promises that tracked links keep working during a flood. `concepts_brief.md:158-159` (M5) asks for separate limits and for direct access to be blocked. Use separate routes and reserved capacity, add an origin check, decide on a firewall rule, and alarm on rejected requests.
* **Reopens an owner decision:** No.

### design-1-11: An unread safeguarding comment can go unnoticed - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 128-130, 194-195, 575-586, 666-671, 721-722
* **Discrepancy Description:** A review task exists only after a successful import, so an outage in DistrictWorkflow or DistrictStatistics means nobody is told a comment is waiting. Escalation runs inside DistrictWorkflow, which may be the system that is down. The "missed import run" alarm has no defined signal, and the design does not say what happens if the deputy does not respond.
* **Rationale & Recommendation:** A young person's disclosure could wait unseen for days. Add an alarm on the age of the oldest unreviewed comment that works when DistrictWorkflow is down. Define the import heartbeat and the step after a deputy fails to respond.
* **Reopens an owner decision:** No.

### style-1-6: A failed import can lose a comment's review task - Severity: Major
* **Reviewer Lens:** `egm-style`, `egm-design`
* **Affected Scope:** Lines 575-586
* **Discrepancy Description:** Line 586 says "A failed run leaves the intake files in place", but step 6 deletes them and three steps follow. If a run fails at step 7, the next run has no intake files from which to find those comments.
* **Rationale & Recommendation:** A safeguarding comment could have no review task. Create review tasks before deleting intake files. Limit the claim on line 586 to failures before deletion, and say how the later steps recover.
* **Reopens an owner decision:** No.

### structural-1-5: Three promised alarms are missing from the infrastructure list - Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-style`, `egm-design` (merges style-1-11)
* **Affected Scope:** Lines 128-130, 297, 697-698, 723
* **Discrepancy Description:** Lines 697-698 omit the overdue comment alarm (G16), the abuse alarms that start CUJ 10 (line 297) and the failed archive verification alarm (line 723).
* **Rationale & Recommendation:** G16 is a safeguarding launch condition, and G18 requires each alarm to be tested. Add one table listing every alarm, its trigger, the system that raises it, who receives it and how it is tested.
* **Reopens an owner decision:** No.

### Missing or undefined behaviour

### design-1-6: The optional volunteer follow-up creates an undefined second response - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-style` (merges style-1-10)
* **Affected Scope:** Lines 91-93, 240, 409-413, 488, 554-555
* **Discrepancy Description:** A person who answered on the open link can add volunteer questions as a "partial response", but CUJ 2 says no second response is created. The partial response has no earlier role answers, so the server's route check would reject it. If accepted, it would count as a separate person. The receipt does not record which roles the person chose, so the design does not explain how the system knows they did not choose Volunteer. "The response" on line 554 could mean the API reply or a survey response.
* **Rationale & Recommendation:** The feature cannot be built as written, and it affects result counts. Define the stored format, validation, counting, minimum-group treatment and how the earlier role choice is known. Update CUJ 2. Otherwise, remove the step from version one.
* **Reopens an owner decision:** Only if the step is removed, which would reopen decision 9a.

### design-1-7: Tracked links have no path for a young person or a former volunteer - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 217-218, 394-395, 407, 549-550
* **Discrepancy Description:** A tracked link preselects Volunteer, but the first question still offers the young-person option. Young people receive no receipt, and a tracked link cannot complete without one. Young Leaders are under-18 volunteers, so this could happen in normal use. There is also no "I'm not a volunteer" route, which `concepts_brief.md:250` (M23) asks for.
* **Rationale & Recommendation:** These people would stay open in the task list and keep receiving reminders. State which roles a tracked link permits, what the server does with any other choice, and how someone declines. Settle the Young Leader question before the invitation list is built.
* **Reopens an owner decision:** No.

### design-1-14: The route from a survey file to the live systems is undefined - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-style` (merges style-1-8)
* **Affected Scope:** Lines 31, 139-140, 290-293, 406, 417-426, 595, 599, 679-680, 823
* **Discrepancy Description:** Line 31 describes one survey file for each year, but line 417 says definitions are stored in DistrictStatistics. The design does not say where an author writes the survey, how it gets there, who approves it, or how the Lambda and DistrictStatistics receive the same compiled version. DistrictStatistics must also recalculate reporting tags (line 599), which needs the routing logic in PHP. Alternative K was rejected partly to avoid that rewrite (line 823).
* **Rationale & Recommendation:** Two versions of the routing rules can disagree and produce wrong results without any error. Use one term and define one publishing path, including validation and approval. Have the TypeScript compiler produce the tags, or store server-calculated tags in the answer file, so PHP does not re-implement the logic.
* **Reopens an owner decision:** No.

### design-1-15: The invitation journey is missing from the specification - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 22-24, 335, 440-450, 983
* **Discrepancy Description:** The specification does not cover importing the volunteer list, test sends, reminder timing and limits, bounces, lost or reissued links, late additions or closing the survey. Line 983 points to existing reminders, but `DistrictWorkflow/docs/reusable-activities.md:288-292` and `:322-324` limit them to response requests, a feature decision 9 says is not used. Starting the results build from DistrictWorkflow also needs a GitHub credential that the design does not mention.
* **Rationale & Recommendation:** The feature's main operating process cannot be reviewed. Add a lifecycle section from list import to confirmed deletion, with each status, operator action and failure case. Mark which DistrictWorkflow capabilities are new.
* **Reopens an owner decision:** No.

### style-1-9: "Final results email" is undefined and conflicts with "one thank-you email" - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 111-112, 231-232, 633, 974
* **Discrepancy Description:** Line 974 deletes invite UUIDs "after the final results email has been sent", but the feature description defines only one thank-you email.
* **Rationale & Recommendation:** This email triggers a deletion that cannot be undone, and its timing, recipients and content are undefined. Define the email and amend G10 and the CUJs, or change line 974 to name the real trigger.
* **Reopens an owner decision:** No.

### style-1-12: The hosting table presents unconfirmed systems as existing - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 20, 190-193, 677-679
* **Discrepancy Description:** The table describes hosting in the present tense, while line 190 asks whether DistrictWorkflow is running in production. The reviewer found no tunnel resource in `DistrictInfrastructure/modules`, and `DistrictWorkflow/docs/architecture.md:103` says production provisioning remains "environment-specific work".
* **Rationale & Recommendation:** A reader cannot separate what exists from what must be built, which affects planning. Add a status column with "exists", "to be built" or "to be confirmed".
* **Reopens an owner decision:** No.

### style-1-13: Several acceptance terms cannot be measured - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 74-76, 81-82, 84-85, 149, 952-954
* **Discrepancy Description:** These terms have no pass or fail condition: "the design rules agreed in the concepts brief" (G4), "when all services are working normally" (G5), "any other stored field" (G6), "a set retention period" (G22), "expected load" and "a mid-range phone".
* **Rationale & Recommendation:** A tester cannot tell whether these goals have been met. List the brand rules or link to a specific section. Define the G5 conditions, name the approved field list, state the retention period or link to its open question, and give a load figure and device profile.
* **Reopens an owner decision:** No.

### Document standard and decision record

### structural-1-1: There is no Risks and Mitigations section - Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-design` (merges design-1-19)
* **Affected Scope:** Whole range; see lines 94-97, 180-221, 575, 712-726, 933-977
* **Discrepancy Description:** The failure table covers operational faults only. The design never states the small-group inference risk that the owner accepted (`concepts_brief.md:86`, decision 2). Capacity limits have no values (lines 575, 953), and there is no cost estimate. Forwarded links, anonymous disclosures that cannot be followed up and AWS administrator access are scattered or missing. The design also depends on two systems not yet shown to be ready for production.
* **Rationale & Recommendation:** Standard lines 23-27 and 38-39 require these constraints to be stated. Add a risk section with each risk's impact, mitigation, remaining risk and who accepted it. Add expected volumes, capacity limits and costs.
* **Reopens an owner decision:** No. It records the risk accepted in decision 2.

### structural-1-7: The design departs from owner decisions without recording the change - Severity: Major
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 327-330, 354-357, 509-510, 618-629, 650
* **Discrepancy Description:** The design differs from three decisions in the concepts brief and does not say they were replaced:

  | Decision | Concepts brief | Design |
  | --- | --- | --- |
  | 7 | Results are in a separate private bucket | Built results pages are uploaded to the site bucket (lines 623, 650) |
  | 9c | Results are served only through a results API that checks a pass | CloudFront signed cookies, with no results API (lines 626-629) |
  | 9 | The submit Lambda sends the UUID to SQS | The tracking Lambda sends it, and the response Lambda never receives the UUID (lines 327-330, 510) |

* **Rationale & Recommendation:** A reader holding both documents cannot tell which one applies. Add a short "Changes from the concepts brief" section that names each replaced decision, the reason and the owner's confirmation.
* **Reopens an owner decision:** **Yes, decisions 7, 9 and 9c.** The owner should confirm or reverse each change.

### design-1-18: Several rejection reasons restate the chosen design - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-structural` (merges structural-1-2)
* **Affected Scope:** Lines 799, 816-817, 832-833, 854-855, 862, 877-878, 895, 901-902, 915
* **Discrepancy Description:** These reasons say what was chosen, not why the alternative lost. For example, "CloudFront signed cookies were chosen for results access". Alternative U lists a real benefit (line 899), but its rejection does not weigh that benefit.
* **Rationale & Recommendation:** Standard lines 19-21 require concrete technical or scope trade-offs. Name the cost, risk or scope reason that decided each one. The outcomes stay the same.
* **Reopens an owner decision:** No.

### structural-1-3: Rejections are attributed to the author without a linked source - Severity: Major
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 732-733, and each "Reason for Rejection" from 742 to 928; see 743-744 and 908-909
* **Discrepancy Description:** The alternatives say "Rejected by author" with no link to a discussion or decision. Two entries mark the reason as inferred, so they credit the author with a reason the author did not give. Lines 732-733 are a drafting instruction left in the document.
* **Rationale & Recommendation:** Standard lines 20-21 bar this kind of attribution without a link. Link each rejection to its numbered decision in the concepts brief where one exists. Otherwise remove the attribution and let the trade-off stand alone. Confirm the two inferred reasons, then delete lines 732-733.
* **Reopens an owner decision:** No.

## Nit

### design-1-20: The last one or two responses may never be published - Severity: Nit
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 609-611
* **Discrepancy Description:** Counts round down to a multiple of 3, and no final release rule is given, although `concepts_brief.md:240` (M21) asks for one.
* **Rationale & Recommendation:** Final figures could leave out valid responses without explanation. State that this is intended and explain it on the results page, or define a final release that still meets the privacy rules.
* **Reopens an owner decision:** No.

### design-1-21: "One thank-you email" is more than the email system can promise - Severity: Nit
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 110-111, 633-634, 719
* **Discrepancy Description:** The existing email activity can send a duplicate after a crash (`DistrictWorkflow/docs/reusable-activities.md:55-57`).
* **Rationale & Recommendation:** Say that repeat completion messages do not trigger another email, and that a rare duplicate is possible after a send failure.
* **Reopens an owner decision:** No.

### design-1-22: The browser storage table omits the submission ID - Severity: Nit
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 559-565, 716
* **Discrepancy Description:** Retries depend on reusing the submission ID, but the table does not say where it is stored or for how long.
* **Rationale & Recommendation:** If it is held only in memory, a reload creates a new ID and possibly a duplicate. Add its storage and lifetime for adult and young-person routes.
* **Reopens an owner decision:** No.

### structural-1-10: Two sections sit under the wrong parent heading - Severity: Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 979, 986
* **Discrepancy Description:** "Additional Resources" and "Future Improvements" are under "Non-Functional Requirements", but neither is a requirement. Their heading case also differs from nearby headings.
* **Rationale & Recommendation:** Promote both to H2 and use one heading case.
* **Reopens an owner decision:** No.

### structural-1-11: Goal numbers are out of sequence - Severity: Nit
* **Reviewer Lens:** `egm-structural`, `egm-style`
* **Affected Scope:** Lines 98, 147-157
* **Discrepancy Description:** G25 sits between G9 and G10, and G26 follows G24.
* **Rationale & Recommendation:** Renumber and update every reference, or state that goal IDs are stable and not ordered.
* **Reopens an owner decision:** No.

### structural-1-12: The same things have different names - Severity: Nit
* **Reviewer Lens:** `egm-structural`, `egm-style` (merges style-1-14, style-1-15 and style-1-17)
* **Affected Scope:** Lines 53, 227, 255, 276, 284, 341, 344, 461, 469, 489, 637, 716
* **Discrepancy Description:** "Idempotence key" and "submission ID" name one value. The tracked link and results link each have several names, including "invite link", "signed email link", "fresh signed link" and "emailed access token". "Open source label" can be read as software licensing.
* **Rationale & Recommendation:** Use one term for each, such as "submission ID", "tracked link", "results link" and "labelled with the source `open`".
* **Reopens an owner decision:** No.

### structural-1-13: Summary tables and the diagram omit flows described elsewhere - Severity: Nit
* **Reviewer Lens:** `egm-structural`, `egm-design`, `egm-style` (merges design-1-23)
* **Affected Scope:** Lines 339-358, 367-368, 460, 553-555, 655-657, 677
* **Discrepancy Description:** The system diagram omits the build-time call to DistrictStatistics and the thank-you email. The intake row omits comment files, the used-records row omits used-pass records, and the `tracking/complete` row omits the tracked pass. The hosting table names comment reviewers but not analysts.
* **Rationale & Recommendation:** Update each table and the diagram to match the detailed sections.
* **Reopens an owner decision:** No.

### structural-1-14: Open questions show no owner or launch impact - Severity: Nit
* **Reviewer Lens:** `egm-structural`, `egm-design`
* **Affected Scope:** Lines 102, 180-221, 976-977
* **Discrepancy Description:** The open questions have no owner, due stage or launch-blocking marker. Some block launch, such as the named reviewer (line 209) and the `[X]` days placeholder in the G25 notice.
* **Rationale & Recommendation:** Use a table with the question, owner, the stage it must close by and whether it blocks launch.
* **Reopens an owner decision:** No.

### structural-1-15: Minor formatting and reference inconsistencies - Severity: Nit
* **Reviewer Lens:** `egm-structural`, `egm-style`
* **Affected Scope:** Lines 65, 227, 412, 650, 981-984
* **Discrepancy Description:** Bold labels place the colon in different positions. Line 650 joins an unrelated sentence to a paragraph and runs past the wrap width. Line 981 is a link relative to the document, but lines 982-984 use paths that do not resolve from this file.
* **Rationale & Recommendation:** Apply one label style and wrap width, split line 650, and state the base for sibling repository paths.
* **Reopens an owner decision:** No.

### style-1-16: "District site" has two meanings - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 312, 419, 655, 668, 677
* **Discrepancy Description:** "A district site's fixed tunnel" means a physical location, but "site" elsewhere means the website, and `district-site` is a repository.
* **Rationale & Recommendation:** Write "a district building with a fixed tunnel", if that is the meaning.
* **Reopens an owner decision:** No.

### style-1-18: Several terms are used without definition - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 26, 68, 149, 175-178, 471
* **Discrepancy Description:** Cohort, persona, Temporal, AlignUI, Turnstile, "How you compare" and "Participation progress" are not defined.
* **Rationale & Recommendation:** Add a short glossary or define each term at first use.
* **Reopens an owner decision:** No.

### style-1-20: The build's data access omits its credential - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 418-419
* **Discrepancy Description:** The text says the build reads data "in the same way that `district-site` reads its data sources", but it does not mention that `district-site/.github/workflows/deploy.yml:91-93` passes a username and password.
* **Rationale & Recommendation:** Name the credential that the build uses. design-1-16 covers the limits that this credential needs.
* **Reopens an owner decision:** No.

### style-1-21: Unconfirmed product claims are stated as fact - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 748, 920
* **Discrepancy Description:** AlignUI's licence terms and LimeSurvey's features are stated as fact, but `concepts_brief.md:343` says neither was confirmed.
* **Rationale & Recommendation:** Mark both as unverified, or cite a source.
* **Reopens an owner decision:** No. The choices in decisions 1 and 11 stay as they are.

### style-1-22: Some wording cannot be measured or judges itself - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 17, 94, 146, 279, 895
* **Discrepancy Description:** "Small" and "clear" are not measured, and the goal title "Accurate promise" judges itself.
* **Rationale & Recommendation:** Remove the adjectives and rename G9 "Respondent promise".
* **Reopens an owner decision:** No.

## Merged Findings

Each merged finding keeps the ID shown here, so raw reviewer findings can be traced.

| Merged ID | Now reported under |
| --- | --- |
| design-1-19 | structural-1-1 |
| design-1-23 | structural-1-13 |
| structural-1-2 | design-1-18 |
| structural-1-6 | design-1-1 |
| structural-1-8 | design-1-17 |
| style-1-1 | structural-1-4 |
| style-1-2 | design-1-17 |
| style-1-4 | design-1-4 |
| style-1-5 | design-1-2 |
| style-1-7 | structural-1-9 |
| style-1-8 | design-1-14 |
| style-1-10 | design-1-6 |
| style-1-11 | structural-1-5 |
| style-1-14 | structural-1-12 |
| style-1-15 | structural-1-12 |
| style-1-17 | structural-1-12 |
| style-1-19 | design-1-1 |

Style's nits are numbered style-1-14 to style-1-22, following its 13 Major findings.
