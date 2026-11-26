# Comprehension Test Report

**Target:** `/Users/jacob/Development/district-survey/docs/designs/district_survey.md` (FeatureRange 1-993, DetailedRange 994-1441)

**Stage:** 6, Comprehension Test

**Reviewer:** `egm-comprehension` (completed). The reviewer read only the persona and all 1,441 lines of the target.

**Result:** 1 Blocker, 17 Major, 7 Nit

## What this proposes

The document proposes a reusable survey website for a Scout district. It shows each person only the questions that fit their answers, and it tracks which invited volunteers have responded without linking that tracking to what they said. A static site uses two separate Lambda functions: one validates and saves answers to S3, and the other checks invitation links, records completion and grants access to results. Every 12 hours, DistrictWorkflow moves saved answers into DistrictStatistics, archives them and deletes the originals. DistrictStatistics then calculates grouped results (minimum group of 6, moving in steps of 3), and a GitHub Action publishes them to pages that only volunteers who completed a tracked link should reach. Comments are never published. A named person reviews them privately, because young people may disclose harm anonymously.

## How the existing system works, per this document

The document says little about what exists today. The district has a volunteer email list, a Route 53 domain, a Terraform repository (DistrictInfrastructure) with a contact form that uses Turnstile, a Cognito setup, a private Kubernetes cluster defined in Homelab, and self-hosted GitHub runners. DistrictWorkflow appears to be a Temporal-based workflow application for tasks, reminders and email, and DistrictStatistics appears to be a CakePHP application with PostgreSQL. The document calls these "existing or planned" without saying which is which, and it plans new deployments for both, so I cannot tell whether either is running today (see finding 2).

## Findings

### 1. Severity: Blocker

* **Lines:** 552-555 (also 91-93, 240, 366, 488)
* **Problem:** I cannot paraphrase the "optional partial response". A volunteer who answered on the open link without choosing Volunteer gets a tracked pass so they can answer the volunteer questions. However, CUJ 2 says no second response is created, and the document does not say how this extra response is stored or counted. Nothing explains how the system knows they did not choose Volunteer, because the receipt holds only a survey ID, receipt ID and expiry, and the tracking Lambda never sees answers. "The response" on line 554 could also mean the API reply or a survey response.
* **Recommendation:** Add a short flow covering who detects this case, what the person sees, what is stored, whether it counts as a second response in results, and how routing validation accepts a partial set of answers. If the feature is not needed, remove it.

### 2. Severity: Major

* **Lines:** 20, 190-193, 590, 603, 1001, 1272-1276, 1315-1326
* **Problem:** The reader cannot tell what DistrictWorkflow and DistrictStatistics are today. Line 1001 assumes both run on the cluster, but lines 1315-1326 create their deployments and the open questions ask whether they are ready. Line 590 adds tables to an existing database, while line 1318 creates a PostgreSQL deployment.
* **Recommendation:** Add a "Current state" section stating, for each system, what it does, its technology, whether it is live, and what this project must build first.

### 3. Severity: Major

* **Lines:** 31, 139, 290-291, 417-420, 424, 434, 999, 1003, 1027, 1278
* **Problem:** The source of the survey definition is unclear. The document speaks of a yearly "survey file", but the real definition is stored in DistrictStatistics, and line 1003 also mentions a "private settings file". It never explains how an author's file reaches DistrictStatistics, which file `yarn survey:validate` reads, or where the "previous survey" used for comparison comes from.
* **Recommendation:** Describe the author's workflow step by step, from writing the file to the build using it, and name one source of truth for definitions and settings.

### 4. Severity: Major

* **Lines:** 1003 (compare 186, 196, 203, 211, 215, 217)
* **Problem:** The document says the other open questions become settings and do not change the code structure. Several clearly could: a closing grace period, what approving a comment does, recording "started" status, adult comments and Young Leader questions.
* **Recommendation:** Mark each open question as either a settings value or a design decision needed before build, and name the affected components.

### 5. Severity: Major

* **Lines:** 449, 524-528, 564, 1091
* **Problem:** The invite token is kept only in memory and removed from the address bar, but the tracked pass and draft survive in local storage. If someone reloads or returns later and then submits, step 6 needs an invite link the page no longer holds. The document does not say what happens, or whether the person must reopen their email.
* **Recommendation:** Describe the resume journey, including how completion happens after a reload and what the person is told.

### 6. Severity: Major

* **Lines:** 149, 369, 520, 572-575, 667, 830-831, 1434
* **Problem:** Answer files are named with the submission ID, and workflows pass file names. DistrictWorkflow therefore appears to hold the same ID that DistrictStatistics stores with the answers, alongside named completion times. S3 listings also normally return upload times. The "What each system can see" table does not address this, so the central separation claim cannot be confirmed.
* **Recommendation:** State exactly what DistrictWorkflow receives and keeps from each listing, including in Temporal history, and explain why this cannot link a person to their answers. If it can, change the file naming or the data passed.

### 7. Severity: Major

* **Lines:** 86-87, 100-102, 367, 575, 586, 721, 971
* **Problem:** The goals, the system table and the respondent-facing notice say exact upload times last up to 12 hours. Files can stay longer if a batch limit is reached, an import fails or DistrictWorkflow is down. Line 971 admits the failure case, so the public wording would sometimes be untrue.
* **Recommendation:** Align every statement with the real maximum, and reword the privacy notice so it remains true during failures.

### 8. Severity: Major

* **Lines:** 151, 578, 597, 610-611
* **Problem:** "Shuffled import position" is never defined. Shuffling is described as happening when the archive is made, after import, yet DistrictStatistics stores a shuffled position. Line 610 also holds back the "newest" responses by that position, although a shuffled order does not show which are newest.
* **Recommendation:** Define where and when this position is assigned, whether there are two separate shuffles, and which responses are held back.

### 9. Severity: Major

* **Lines:** 129-130, 666-671, 697-698, 1236
* **Problem:** The reviewer records the outcome in DistrictStatistics, but escalation runs in DistrictWorkflow. Nothing explains how DistrictWorkflow learns a comment was reviewed, so reviewed comments could still escalate. G16 promises an alarm, but the alarm list has none for overdue comments, and the document describes only escalation to the deputy. It does not say what happens if the deputy also misses the deadline.
* **Recommendation:** Add the status flow between the two systems, name the overdue alarm and who receives it, and define the final escalation step.

### 10. Severity: Major

* **Lines:** 575-586
* **Problem:** Originals are deleted at step 6, but comment review tasks are created at step 7. The document says a failed run leaves intake files for the next run, which is not true after step 6. It does not explain how a retry finds the comments, so a safeguarding comment could appear to have no review task.
* **Recommendation:** Explain how a run resumes after deletion, or create review tasks before deleting the originals.

### 11. Severity: Major

* **Lines:** 974, 1238, 1261 (compare 110-112, 633)
* **Problem:** A "final results email" affects when invite UUIDs are deleted and appears in the code and tests, but it is never described. The main design mentions only one thank-you email.
* **Recommendation:** Define who receives it, when it is sent, what it contains and how it relates to the "one thank-you email" rule, or remove it.

### 12. Severity: Major

* **Lines:** 108-113, 648-649
* **Problem:** G10 says only a person with a completed tracked link can see results. The design later accepts that anyone who receives a forwarded email can view them for months, and the shared token identifies nobody, so it apparently cannot be revoked for one person.
* **Recommendation:** Reword G10 to match the real access rule, and state that this risk is accepted and whether a link can be withdrawn.

### 13. Severity: Major

* **Lines:** 157-159, 207, 278, 315, 606, 615-616, 659-661
* **Problem:** "Permitted question", "permitted breakdown" and "fixed breakdown" are not defined, and the survey format has no field for them. The dashboard reads only published releases, so it is unclear whether volunteers receive the same breakdowns as analysts, including tracked and open comparisons.
* **Recommendation:** Define these terms, say where the permissions are configured, and state what each audience can see.

### 14. Severity: Major

* **Lines:** 491, 509, 516-518, 525, 553, 718, 1108
* **Problem:** The used-record design is incomplete. The document does not say which key the response Lambda uses for its HMACs, because the link-reference key is held only by the tracking Lambda. Used-link and used-receipt record contents are not described. If SQS fails after those records are created, the document does not explain how the retry succeeds when a receipt can be used only once.
* **Recommendation:** Add a table of each record's name, contents, signing key and retry behaviour.

### 15. Severity: Major

* **Lines:** 299-300, 725, 963, 1260, 1423
* **Problem:** The spam recovery journey is not explained. The document does not say how an operator closes open submissions, where the switch lives, or how responses are removed by day from the database, archives and already published results. "Operator" is also undefined.
* **Recommendation:** Describe the switch and removal procedure, including what happens to published figures, and define the operator role.

### 16. Severity: Major

* **Lines:** 793, 830-831, 840 (compare 83-87, 116-117, 151)
* **Problem:** The main privacy threat appears only in the rejected alternatives: someone could match upload times to completion times, or compare results before and after a submission. Without it, the date-only storage, shuffling and stepped updates in the main design look arbitrary.
* **Recommendation:** Add a short threat section near the start stating who the design protects against, which attacks matter, and which control addresses each.

### 17. Severity: Major

* **Lines:** 702-704, 939, 958, 1002, 1007-1012, 1138, 1145, 1220, 1349
* **Problem:** The infrastructure plan conflicts with itself. The module receives a certificate and role ARNs, yet it also creates a certificate and IAM users. The delivery order has a test deployment in step 2, before infrastructure in step 3, and no file creates the test environment that the rollout and deployed tests depend on.
* **Recommendation:** State what the module creates and what it receives, correct the delivery order, and add how the test environment is created.

### 18. Severity: Major

* **Lines:** 26, 68, 136, 154, 188, 567, 741, 870
* **Problem:** Persona, role, section, cohort and route are core terms used without definitions, and they overlap. "Cohort" is never explained, and "route" also means an API route elsewhere.
* **Recommendation:** Add a glossary near the top with one example of each, and use "question path" or similar for survey routes.

### 19. Severity: Nit

* **Lines:** 123-125, 215-219
* **Problem:** Beavers, Cubs, Scouts, Explorers, Squirrels, Young Leaders and Network are not explained. Their age ranges matter because the comment rules depend on them.
* **Recommendation:** Add a small table of sections and age ranges.

### 20. Severity: Nit

* **Lines:** 312, 419, 655, 668, 677, 702, 891
* **Problem:** "A district site's fixed tunnel" is unclear: "site" could mean a physical location or the `district-site` repository. `district-site`, "the contact form" and "the shared CloudFront module" are also unexplained.
* **Recommendation:** Define each one briefly where it first appears.

### 21. Severity: Nit

* **Lines:** 53, 93, 227, 276, 284, 469, 524
* **Problem:** The same things have several names: tracked link, invite link and tracked invitation; idempotence key and submission ID; and "fresh signed link" for the reusable results link.
* **Recommendation:** Choose one name for each concept and use it throughout.

### 22. Severity: Nit

* **Lines:** 255
* **Problem:** "Open source label" can be misread as open-source software.
* **Recommendation:** Write "labelled with the source `open`".

### 23. Severity: Nit

* **Lines:** 489, 600, 1058, 1120
* **Problem:** "Access level", comment "audience", "reserved yellow style" and "dated evidence" are used without explanation.
* **Recommendation:** Add a brief definition for each, or link to where it is defined.

### 24. Severity: Nit

* **Lines:** 626, 645, 686-687, 1024
* **Problem:** Results paths vary between `/results*` and `/results/*`, and the page opens `/results/` although `trailingSlash` is set to false.
* **Recommendation:** Use the exact paths consistently and confirm the redirect behaviour.

### 25. Severity: Nit

* **Lines:** 522, 1087, 1124 (compare 530-542)
* **Problem:** The answer file format is shown, but the comment file format is not, so the reader cannot check what a comment stores, including its date and audience.
* **Recommendation:** Add an example comment file next to the answer file example.
