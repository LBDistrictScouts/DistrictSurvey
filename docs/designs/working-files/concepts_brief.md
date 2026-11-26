# District Survey Tool

* **Author:** Jacob Tyler
* **Date:** 2026-11-18

## Overview

Letchworth, Baldock & Ashwell Scout District wants a survey tool that does two things a Google Form cannot: track which invited people have completed the survey while keeping that record apart from their answers, and use opening questions to decide which questions each person answers. Later aims are results unlocked by completing the survey, reuse each year, and publishing the code for other districts.

Seven reviewers examined the concept. They found the privacy position coherent and the running cost low. They did not find it ready for a detailed specification. The review recorded **10 Blocker, 30 Major and 12 Nit** findings after duplicates were merged.

Three problems matter most:

1. Published results can be compared over time to work out how a small group answered, which breaks the promise made to respondents.
2. A young person could disclose harm in an anonymous comment box, and nobody could follow it up.
3. The reviewers questioned building at all, because LimeSurvey was untested. The owner has since decided to build, on budget grounds.

Most of the remaining findings concern parts the concept does not yet describe: how the survey is operated, how results are reached, and what happens when something fails.

**Decisions 7, 9, 9a and 9c were later replaced during drafting and review. `docs/designs/district_survey.md` records the changes and takes priority.**

**After the review, the owner settled the decisions listed under "Owner decisions". Where the Analysis or Risks sections differ from those decisions, the decisions apply.**

Paths in this brief use three short names:

* `APP` is `/Users/jacob/Development/district-survey`
* `INFRA` is `/Users/jacob/Development/DistrictInfrastructure`
* `SITE` is `/Users/jacob/Development/district-site`

## Analysis

### Reviewer status

| Lens | Role title | Status | Blocker | Major | Nit |
| --- | --- | --- | --- | --- | --- |
| `egm:egm-design` | Design-Brainstormer | completed | 4 | 10 | 4 |
| `egm:egm-codebase-details` | Codebase-Details-Brainstormer | completed | 3 | 11 | 2 |
| `egm:egm-zoom-out` | Zoom-Out-Brainstormer | completed | 1 | 9 | 4 |
| `egm:egm-comprehension` | Comprehension-Brainstormer | completed | 3 | 13 | 6 |
| `egm:egm-implementation-readiness` | Implementation-Readiness-Brainstormer | completed | 3 | 11 | 5 |
| `egm:egm-structural` | Structural-Brainstormer | completed | 3 | 12 | 3 |
| `egm:egm-inventive-catalyst` | Inventive-Catalyst-Brainstormer | completed | 1 | 10 | 5 |

The counts above are each reviewer's own, before merging. Where reviewers rated the same issue differently, this brief uses the highest rating.

### Inventive contradictions, suggested patterns and secondary trade-offs

| # | Contradiction | Suggested pattern | Secondary trade-off |
| --- | --- | --- | --- |
| 1 | Frequent results are fresher, but each release exposes the small batch of people who answered since the last one. | **Preliminary action:** fix the merged groups and a few release points in the survey file. **Segmentation:** coarse figures during the survey, finer figures at the end. **Self-service:** an automatic check withholds any release that reveals a batch. | Results are less fresh. The check needs thorough tests. Withheld releases need explaining to analysts. |
| 2 | Reminders need completion status, but the person who sees named status is best placed to work out who said what. | **Inversion:** the operator presses "remind everyone outstanding" and sees only counts. **Extraction:** one separate sending function is the only reader of the invite table. | No personal nudges. A send limit and a practice run are needed. The secret used to rebuild links becomes critical. |
| 3 | A static site routes questions in the browser, but the key rules need enforcing on the server. | **Segmentation:** one shared routing package runs in the browser and the submit function. **Preliminary action:** each survey file is compiled to a fixed, fingerprinted version. | The submit function must run on Node rather than Python. Changing a live survey needs a version policy. |
| 4 | Young people's comments are useful, but a comment can identify the writer, and review may be slow. An anonymous disclosure can never be followed up with that person; this limit cannot be designed away. | **Segmentation:** store comments apart from answers. **Beforehand cushioning:** say "we cannot reply to this" and who to talk to before the box. | Comments cannot be analysed against answers. Alerts need a rota. |
| 5 | A server-checked results gate creates a record of viewing, which the concept rules out. | **Segmentation:** shareable results are public files; volunteer results are a separate tier. **Inversion:** give volunteers a hard-to-guess link when they submit. **Beforehand cushioning:** show progress until results exist, and email the final link before invite data is deleted. | A forwarded link grants access. The link must never reach access logs. |
| 6 | Operators need to diagnose failures, but logs create a timeline of submissions. | **Extraction:** rely on built-in metrics and a scheduled test submission. **Beforehand cushioning:** reproduce faults outside production with made-up data. | Live faults are harder to diagnose. The test submission needs excluding from results. |
| 7 | Reusing the CloudFront module saves work, but brings in logging and settings the survey cannot accept. | **Segmentation:** a small distribution written for the survey, with no logging, strict browser rules and a separate store for results. | A second CloudFront definition to maintain. No access logs during an incident. |
| 8 | Tight limits per connection block a whole section in one hall; loose limits allow flooding. Duplicates on shared devices can never be fully removed. | **Dynamics:** a high limit per connection that can be lowered during an attack. **Intermediary:** make CloudFront the only route to the API. **Blessing in disguise:** treat suspicious spikes as a reason to exclude open responses, using the source label already recorded. | Firewall cost, a shared secret to rotate, and some duplicates remain. |
| 9 | Group-level progress needs a Group signal, but adding Group to responses makes people easier to identify. | **Segmentation:** give each Group its own open link, counted in a separate table. **Dynamics:** cap each link near the Group's size. | More links for leaders to hand out, and links can still be forwarded. |
| 10 | Saving progress is convenient, but server drafts tie answers to a person and browser drafts expose them on family devices. | **Inversion:** drafts stay in the browser only. **Segmentation:** young people's drafts last only for the session. | Some people must restart. Closing a tab loses a young person's progress. |
| 11 | Existing deployment patterns are quick to reuse, but a leaked deploy key could change the code respondents load and capture their answers. | **Cheap dispensables:** short-lived deploy credentials limited to protected branches. **Segmentation:** separate Terraform state for the survey. | Extra setup, wiring between states, and a separate deployment. |
| 12 | One public repository must also serve district settings and logos that have to stay out of it. | **Extraction:** a reusable engine plus a thin district layer. | Versions must be pinned across two repositories. |
| 13 | "Deleted" invite data can survive in backups and email feedback queues. | **Self-service:** a scripted deletion checklist that covers every copy, and no rolling backup on the invite table. | Lost invites must be rebuilt from the source list. |
| 14 | The white logo must not sit on an unapproved dark background, but the dark theme needs one. | **Segmentation:** place the logo on a Scouts Purple band. | Less layout freedom. |
| 15 | The question ID rule depends on people remembering it. | **Preliminary action:** commit a record of each ID with its wording and options, and fail the build on a change. | Typo fixes need a deliberate decision. |

### Ideal Final Result

The survey is a set of static files plus one submit function that stores only valid responses, checks them against the same rules the browser uses, and writes no personal detail to logs. Reminders run without anyone seeing names. Results are pre-built files, released only after an automatic check proves they are safe against every earlier release, so viewing them leaves no record. Another district adopts the tool by supplying one settings file and one survey file.

### Parts the reviewers support

* Separate invite and response tables, written in one transaction.
* The token in the URL fragment and POST body, provided it is removed from the address bar straight away.
* No token, invitee ID or IP address on responses. The reviewers also supported leaving timestamps off. The owner has since chosen to store the submission date, with no time of day (decision 6).
* The owner's decision not to seek cryptographic proof against AWS administrators.
* Reuse of Turnstile, with a separate widget for the survey.

### Cost and scale

The design lens estimated pennies per survey for storage, functions, email and the daily job, based on 5,000 responses of 20 KB each. An AWS web firewall, if adopted, would be the largest recurring cost at roughly USD 5-10 a month, and could run only during the survey. These figures are estimates and prices were not checked. The practical capacity risk is blocking real respondents (M5).

### Risks: Blocker

**B1. Published results can be worked back to a small group's answers**
* **Lenses:** Inventive catalyst, Design, Structural, Comprehension
* **Risk:** The minimum group sizes apply to each published total, not to the change between two releases. If a cohort moves from 100 to 110 responses and an option moves from 40% to 45%, then at least 9 of the 10 new people chose that option. Anyone who knows who completed that day learns how they answered. Whole-percent rounding also reveals exact counts when the group size is known, and participation figures can supply that size. Ten new responses in a cohort may mean only one new answer to a routed question. A group merged in one release and separate in the next can be found by subtraction.
* **Reviewers' action:** Apply thresholds to the change in each published figure. Require at least 20 new responses, or 10% of the cohort if that is larger, per release. Round to the nearest 5% below 100 responses, and show participation in bands. Keep merges fixed once published. Prefer a few fixed release points to daily updates. Add tests that attack consecutive releases.
* **Owner decision:** Each question's results appear once it reaches 6 responses, because the owner considers the content low in sensitivity. This accepts that small groups' answers can sometimes be inferred, so the respondent promise must not claim that individual answers can never be worked out.

**B2. Young people's comments have no safe route for a disclosure**
* **Lenses:** Comprehension, Codebase details, Design, Zoom-out, Inventive catalyst
* **Risk:** A Scout or Explorer could disclose harm in a box that stores nothing identifying, and may believe they have told someone. The respondent promise says reviewers "only see grouped results", yet a person reads individual comments. "Prompt review" has no target and no named reviewer, and nothing would show that a comment is waiting. A comment stored with a response also exposes that person's other answers to the reviewer.
* **Owner decision:** Scouts and Explorers get comment boxes in version one. Beavers and Cubs do not.
* **Launch conditions:** The build must fail without a named reviewer, deputy and review deadline. Store comments apart from answers, say beside the box that nobody can reply, place the safeguarding panel next to it, write an escalation procedure, and alarm on the age of the oldest unread comment without including its text. Amend the promise to say a named role reads comments. An anonymous disclosure still cannot be followed up with the young person who wrote it.

**B3. Build versus adopt has not been decided**
* **Lenses:** Zoom-out, Structural, Design
* **Risk:** The case for building rests on two features, and LimeSurvey may cover both. No reviewer could confirm this. Adopting has its own cost: no server, database or container resources appear in the Terraform code, so LimeSurvey would be the district's first patched server holding children's data.
* **Resolution:** The owner decided to build, because the district does not have the budget for LimeSurvey. No product test will be run.

**B4. Results unlocking and access levels have no working mechanism**
* **Lenses:** Design, Structural, Implementation readiness, Comprehension, Inventive catalyst, Zoom-out
* **Risk:** A static site cannot restrict a file (`APP/CLAUDE.md:22-30`). Extra CloudFront file stores have no viewer sign-in (`INFRA/modules/cloudfront-distribution/main.tf:489-500`), so volunteer-only results placed there would be public. Volunteer access that relies on the invite stops working when invite data is deleted, just as final results arrive. Early respondents unlock nothing because no group has reached its minimum. Open-link respondents have no way to return. Shareable results must already be safe as public, so the unlock protects nothing.
* **Resolution:** Only people with a completed tracked link see results, using a signed, expiring pass that survives invite deletion (decision 9c). Show a clear "no results yet" state until a question reaches its minimum. Send the final results link through DistrictWorkflow before invite data is deleted. Serve analyst data only after sign-in.

**B5. The invitation and operating journey is missing**
* **Lenses:** Design, Comprehension, Structural, Zoom-out, Implementation readiness, Codebase details
* **Risk:** Completion tracking is the first reason for building the tool, yet the concept does not cover importing the list, creating tokens, sending, bounces, reminders, reissuing a lost link, or closing the survey. The email module sets up the domain only, and its bounce queue has no consumer (`INFRA/modules/transactional-email/README.md:24-25`). If only scrambled tokens are stored, a reminder cannot contain the original link.
* **Action:** Specify the journey from import to confirmed deletion, including preview, test send, send, bounce display, reminders to non-completers only, and reissue. A command-line script under one restricted role is enough for version one. Build each link from a survey-specific secret so reminders can recreate it, then destroy the secret at close. Turn off email click and open tracking, respect sending limits, and give the survey its own bounce handling.

**B6. Survey rules are checked at build time but not when answers arrive**
* **Lenses:** Design, Structural, Implementation readiness, Inventive catalyst
* **Risk:** Anyone can send a hand-written request to an open link, combining young-person and adult roles or adding free text to a Beavers path. The site and functions also deploy separately, so a respondent can hold an older survey than the server. Fixing a typo during a live survey creates a new question ID and splits that question's results.
* **Action:** Compile each survey file into a fixed version with a fingerprint, and freeze it when the survey opens, allowing only a listed set of minor fixes. Share one routing package between browser and server. Reject wrong versions with a "please refresh" message, and reject answers the route does not allow, roles the link does not permit, and oversized requests. Store the survey ID and version on every response. Give answer options stable IDs too.

**B7. Bad responses cannot be removed selectively**
* **Lenses:** Implementation readiness
* **Risk:** With no token, IP address or timestamp, a spam flood, pilot data or a faulty release cannot be separated from good responses. The only remedy would be discarding the whole dataset.
* **Resolution:** Each response stores an idempotence key and the submission date only, so bad responses can be removed by whole days. Keep pilot data under a separate survey ID. Add a server switch that closes open links, tracked links or the whole survey independently.

**B8. Nothing defines what may be logged**
* **Lenses:** Codebase details, Inventive catalyst, Structural
* **Risk:** The concept lists what must not be logged but not what may be. Developers will either log too little to fix faults or add details that identify people. Persona, section, path or request size on a log line can fingerprint a respondent, and every log event carries a time.
* **Action:** Publish an approved list. Allowed: request ID, route, fixed outcome and failure codes, a latency band, source, survey version and build ID. Banned: tokens or scrambled tokens, invite ID, response ID, IP address, browser details, headers, request body, persona, section, answers, path, request size and error text. Enforce the list with a logger and a test that fails on any other field. Good starting points are `INFRA/modules/contact-form/lambda/handler.py:162-172` and the API log format at `INFRA/modules/members-area/api-gateway.tf:119-124`, which omits the request time.

**B9. A failed submission would raise no alarm**
* **Lenses:** Codebase details
* **Risk:** The contact form catches every error and returns a 503 (`INFRA/modules/contact-form/lambda/handler.py:377-383`), so AWS counts the run as successful and the error alarm (`INFRA/modules/contact-form/main.tf:139-153`) stays silent. Copying this pattern could lose answers for a whole survey with no alert.
* **Action:** Alarm on API 5xx responses and on a metric for each failure type. Add a failure-rate alarm. Prove each alarm before launch by causing the fault in a test environment.

**B10. Public code and private district setup have no defined home**
* **Lenses:** Structural, Comprehension, Implementation readiness, Design, Zoom-out
* **Risk:** The concept places the module in the existing Terraform repository and also publishes it from the start. That repository holds district-specific details (`INFRA/main.tf:15-18`, `INFRA/main.tf:169-212`), and its modules depend on neighbouring folders (`INFRA/modules/contact-form/main.tf:2,9,40`). If district files share a repository with the engine, every adopting district's copy will conflict on each upgrade.
* **Action:** Keep the engine and a self-contained Terraform module in the public repository. Keep each district's survey file, settings, logos and root Terraform in a separate private layer, using a pinned release. The Zoom-out lens disagrees on timing; see decision 8.

### Risks: Major

**M1. Submission retries are undefined**
* **Lenses:** Design, Structural, Implementation readiness, Codebase details, Comprehension
* **Risk:** If the reply to a successful submission is lost, a retry shows a tracked respondent an error and creates a duplicate on an open link. The contact form's function and API timeouts are both 10 seconds (`INFRA/modules/contact-form/main.tf:48,80`). The submit function is also the one place that can link both tables.
* **Action:** Use a random ID per submission, generated in the browser and never derived from the invite token, with a write that succeeds only once. Treat a repeat as success. Allow invite status to move forward only. Keep answers in the browser until success is confirmed. Set the function timeout below the API timeout. Avoid time-ordered IDs and DynamoDB Streams on the response table. Give each function its own permissions, and test that responses contain only approved fields.

**M2. Sub-pages will fail with the existing CloudFront address rewrite**
* **Lenses:** Implementation readiness, Zoom-out, Design, Structural, Codebase details
* **Risk:** The app writes `/route/index.html` (`APP/next.config.ts:6-7`), but the rewrite turns `/route/` into `/route.html` (`INFRA/modules/cloudfront-distribution/clean-urls.js:9-16`). Using the single-page fallback instead would turn missing files and API errors into successful-looking responses (`INFRA/modules/cloudfront-distribution/main.tf:512-520`).
* **Action:** Set `trailingSlash: false` and use clean address rewrites, as the main site does (`INFRA/main.tf:105`). Do not use the fallback. Test every route and the results files after each deployment.

**M3. The shared CloudFront module does not fit the survey**
* **Lenses:** Structural, Implementation readiness, Design, Inventive catalyst, Zoom-out, Codebase details
* **Risk:** Access logs are on unless the members feature is enabled (`INFRA/modules/cloudfront-distribution/main.tf:393-400`), and the log bucket is always created (`main.tf:91-97`). Public pages get no security headers (`main.tf:404-419`). The site bucket is disposable and the deploy deletes unknown files, so results stored there would be lost (`main.tf:8-11`, `SITE/.github/workflows/deploy.yml:325`). Extra buckets create long-lived keys by default (`variables.tf:151-155`). Changing this module also puts the live website at risk.
* **Action:** Give the survey its own distribution with logging off and security headers on. Keep results in a separate private bucket, using unchanging versioned files and a short-lived pointer file so a bad release can be rolled back. See decision 7.

**M4. Browser security rules and token handling need early proof**
* **Lenses:** Structural, Implementation readiness, Design, Codebase details, Inventive catalyst
* **Risk:** A URL fragment stays out of server logs, but any script on the page can read it. The usual per-request security approach needs a running server, and the alternative is experimental (`APP/node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md:181,456-460`). Rules tied to each build could break the live survey if the site and infrastructure deploy out of step. The theme script and Turnstile must also be allowed.
* **Action:** Read the token once and remove it from the address bar immediately. Load no third-party script on tracked pages. Choose browser security rules that stay stable between builds, and test them in report-only mode outside production before enforcing them.

**M5. Rate limits could block real respondents while failing to stop abuse**
* **Lenses:** Design, Implementation readiness, Structural, Inventive catalyst, Comprehension, Codebase details, Zoom-out
* **Risk:** The contact form allows 2 requests a second with a burst of 5 (`INFRA/modules/contact-form/variables.tf:55-65`), shared across the whole API (`INFRA/modules/contact-form/main.tf:100-103`). One abuser could use up capacity for invited volunteers, and a section finishing together on hall Wi-Fi looks like an attack. Rejected requests never reach the function, so its alarm misses them. The public API can also be called directly, bypassing CloudFront.
* **Action:** Size limits from expected peaks once audience sizes are known, and load-test before the first send. Set separate limits for open and tracked submissions. Add a high per-connection firewall rule on submit only, block direct API access, alarm on rejected requests, and retry in the browser while keeping answers. Make any duplicate warning advisory, with a "start another response" action for shared devices.

**M6. Turnstile could fail at the final step**
* **Lenses:** Design, Comprehension, Implementation readiness
* **Risk:** A check obtained at the start of a long survey may expire before submission. Widgets are tied to website hostnames (`INFRA/modules/public-website/main.tf:23-30`), and the existing component is fixed to the light theme (`SITE/src/components/TurnstileForm.tsx:50`).
* **Action:** Create a separate widget. Run the check at final submission, get a fresh one on each retry, keep answers throughout, and pass the active theme. Record Cloudflare as a data processor in the privacy notice and data protection assessment.

**M7. Saving and resuming affects the data design and is still open**
* **Lenses:** Structural, Implementation readiness, Comprehension, Design, Inventive catalyst
* **Risk:** Server drafts would link unfinished answers to a person, which conflicts with the promise. Browser drafts could expose one family member's answers to another.
* **Action:** Do not support switching devices in version one, and say so on the start screen. Keep young people's answers for the session only. Give adult drafts a short expiry and a visible "clear my answers" action. Clear everything after submission, and discard drafts when the survey version changes.

**M8. Shared Terraform state and long-lived deploy keys widen the damage from a mistake**
* **Lenses:** Structural, Implementation readiness, Design, Inventive catalyst
* **Risk:** All resources share one state (`INFRA/terraform.tf:2-7`) and each manually triggered apply covers the whole estate (`INFRA/.github/workflows/terraform.yml:46,229-231`), so an urgent survey fix would depend on unrelated changes. A leaked long-lived key (`INFRA/modules/public-website/deployer.tf:1-11`) could replace the code and capture answers and tokens. This matters more for a public project.
* **Owner decision:** The root Terraform in `DistrictInfrastructure` imports a pinned release of the survey module and shares the existing state.
* **Action:** Deploy website and Lambda code from the survey repository with short-lived GitHub credentials limited to a protected branch, and never expose them to pull requests. Keep signing secrets out of Terraform state.

**M9. Backup, deletion and retention are not specified**
* **Lenses:** Design, Codebase details, Structural, Implementation readiness, Inventive catalyst
* **Risk:** A year's responses cannot be collected again, yet no table protection exists in the Terraform code. Backups, logs and the 14-day email feedback queue (`INFRA/modules/transactional-email/feedback/main.tf:30`) can keep invite data after it is "deleted". Nothing proves deletion happened.
* **Action:** Define the stages draft, open, closed, results published, invites deleted and archived, each with an owner and trigger. List every data store with its retention and deletion method. Protect the response table from deletion and enable recovery on it, and leave rolling backup off the invite table. Run a logged deletion job at close, keep dated evidence, and run a daily check that completed invites match tracked responses, reporting only pass or fail.

**M10. Yearly reuse has no storage or upgrade path**
* **Lenses:** Implementation readiness, Structural
* **Risk:** The concept does not say whether each year gets new tables, what survives from the previous year, or how adopters upgrade. A tool used once a year sits idle while its software ages, and volunteers maintain it.
* **Action:** Choose the yearly storage model and keep only grouped results across years. Version the survey and settings formats, with a note for each breaking change. Name a maintainer and a backup, keep dependencies few, and rehearse the whole survey on a test environment before each run.

**M11. The results job depends on past releases and cannot show when it is broken**
* **Lenses:** Structural, Codebase details, Implementation readiness
* **Risk:** "10 new responses" and merged groups both depend on what was published before, but no timestamp exists to find new responses. Withholding a release is normal, so a stopped job looks healthy, and existing alarms treat missing data as acceptable. No scheduled job exists in the Terraform code to copy.
* **Action:** Keep a record of each release, and detect new responses by comparing counts with it. Re-check minimum sizes when the job runs. Send a signal on every run, with an alarm when it goes missing. Validate each release before publishing, and record its generation time, survey version and rules version.

**M12. Alerts have no reliable route or owner**
* **Lenses:** Codebase details
* **Risk:** CloudFront alarms run in `us-east-1`, while the alert topic is in `eu-west-1` (`INFRA/monitoring.tf:1-10`), and the existing CloudFront alarms notify nobody (`INFRA/modules/cloudfront-distribution/members-monitoring.tf:1-35`). Other alerts go to one mailbox with no named responder.
* **Action:** Add a `us-east-1` alert topic for the survey. Name a primary and a deputy for the survey period, write a one-page guide per alarm, and test a "pause survey" control that shows a holding message.

**M13. Browser failures are invisible**
* **Lenses:** Codebase details
* **Risk:** Routing errors, failed page loads and out-of-date builds never reach the server. Standard error-reporting tools capture full addresses, which would include the tracked token.
* **Action:** Add a first-party error report that accepts only fixed error codes, the build ID and the survey version, with no address, error text or answers.

**M14. The tracked-link lifecycle is incomplete**
* **Lenses:** Structural, Codebase details, Implementation readiness
* **Risk:** Three statuses do not cover bounced, reissued, revoked or closed links. A bounced invitation looks like a volunteer who ignored it, which skews completion rates. Re-imports, late additions and shared email addresses are not covered. Email security tools may also alter links.
* **Action:** Keep delivery status apart from completion status, visible only to the reminder sender. Let "completed" succeed even if "started" failed. Make imports and reminder runs safe to repeat. Make reissue cancel the old link and keep the status. Test that the fragment survives common email security tools, and provide a manual code as a fallback.

**M15. The log-copying risk is misdescribed**
* **Lenses:** Codebase details, Structural, Implementation readiness, Inventive catalyst, Zoom-out, Comprehension, Design
* **Risk:** The rule covers one account, not the whole organisation, and copies from 16 regions that exclude `eu-west-1` but include `eu-west-2` and `us-east-1` (`INFRA/modules/log-centralisation/main.tf:29-35`). Survey logs in `eu-west-1` would not be copied, but logs from other regions would. The documents disagree on whether the rule is active (`INFRA/modules/log-centralisation/README.md:3-8`, `INFRA/README.md:55-56,212`).
* **Action:** Keep all survey functions and logs in `eu-west-1`, and avoid code running at CloudFront edge locations on respondent paths. Create each log group in advance with a short retention period. Confirm the rule's live state in AWS before launch and record the result in the data protection assessment.

**M16. Tracing could re-link the two tables**
* **Lenses:** Codebase details
* **Risk:** Request tracing or DynamoDB data-event logging could record the invite and response writes together, recreating the link the design removes.
* **Action:** State that the submit path uses neither. Never store the API request ID on a response.

**M17. Named tracking status is exposed and unaudited**
* **Lenses:** Inventive catalyst, Codebase details
* **Risk:** The person who sees named status can compare it with results, and in a small district may also be an analyst. Nothing would show whether access limits held.
* **Action:** Remove the named view from version one if possible, so the sender sees counts only. Log staff sign-ins, refused access, exports and reminder sends. State that the commitment not to record who views results applies to respondents.

**M18. "District Google accounts" is too broad for staff access**
* **Lenses:** Comprehension, Structural, Design, Zoom-out
* **Risk:** New single sign-on users automatically join the production members group (`INFRA/modules/members-area/cognito.tf:37`), so members access cannot stand in for analyst access. The sign-in is also specific to this district (`INFRA/main.tf:81,109`). Up to six roles are implied, with no access model.
* **Action:** Create explicitly granted groups for invite manager, analyst and comment reviewer, with a role and permission table. Give the survey its own sign-in client, using standard settings that other districts can replace.

**M19. Reporting rules contradict each other**
* **Lenses:** Comprehension, Design, Inventive catalyst
* **Risk:** Analysts can "compare or exclude" open responses, but custom filters are banned. Young people and parents only have open links, so excluding open responses removes them altogether. "Tracked parents" effectively means volunteer-parents, which exposes a role combination that reports must never show. Section progress is meant to use no survey answers, but section is the first answer on open links. Nothing collects Group.
* **Action:** List every permitted report view and test the list against the suppression rules. Remove source breakdowns within a role. Label open results as indicative. Name the data source for each participation figure, or show district-wide progress only.

**M20. Minimum group sizes have not been tested against real numbers**
* **Lenses:** Zoom-out
* **Risk:** Minimums of 10 and 20 applied per question could hide much of the report for small sections, and audience sizes are unknown.
* **Action:** Get membership counts and model likely response rates before building dashboards. Declare merged groups by hand in the survey file rather than building an automatic merging system.

**M21. Dashboards do not explain missing or out-of-date results**
* **Lenses:** Comprehension
* **Risk:** A cohort that ends with fewer than 10 new responses never gets a final update. "Flagged or hidden" is undecided, rounding is unspecified, and people in several roles make totals overlap.
* **Action:** Publish a final release at close, subject to the privacy rules. Show a "last updated" date and one neutral "not shown to protect privacy" message. Label totals that can exceed 100%.

**M22. Respondent failure states are undefined**
* **Lenses:** Comprehension
* **Risk:** The concept does not cover a damaged, revoked, forwarded or already completed link, a survey that closes during a response, or a timeout after a successful submission. The contact form's single generic error (`INFRA/modules/contact-form/lambda/handler.py:158`) would not be enough.
* **Action:** Write a table giving the message, next step and contact for each case.

**M23. Common adult situations have no clear path**
* **Lenses:** Comprehension
* **Risk:** A volunteer missing from the list cannot identify as one, and someone on the list may have stopped volunteering. A parent with children in two sections has no defined way to answer. A shared question asked once does not say which role to answer as.
* **Action:** A volunteer missing from the list can use the open link (decision 9b). Add an "I'm not a volunteer" route on tracked links. Define how parents of several children answer. Word shared questions to work for every role, and check that they are marked as such.

**M24. Going back and survey length are undefined**
* **Lenses:** Comprehension
* **Risk:** Changing a role or section can leave answers on a path no longer in use, and combined roles make the length unpredictable.
* **Action:** Warn before discarding answers, and never submit answers from an inactive path. Show progress in parts, give a time estimate once roles are chosen, and set a maximum length for the longest role combination.

**M25. Squirrels are missing**
* **Lenses:** Comprehension
* **Risk:** The concept lists four youth sections, but the district site also has Squirrels (`SITE/src/lib/joining-age.ts:4`). Their parents could not report their child's section.
* **Action:** Include Squirrels on the parent path, and state whether Squirrels themselves take part.

**M26. The youngest children's answer format is unsolved**
* **Lenses:** Comprehension
* **Risk:** Text-only scales are hard for six-year-olds and smiley scales are ruled out. "How you compare" could make a child feel different from their peers on a sensitive question.
* **Action:** Use two or three large worded options with non-face icons, and tell the helping adult how to assist without steering. Turn "How you compare" off for young people until the open decision on results is made. Test the wording with children from each section.

**M27. The survey author's experience is undefined**
* **Lenses:** Comprehension, Structural, Inventive catalyst
* **Risk:** The file format, error messages and question ID checks are not defined. The scaffold has no validation step (`APP/package.json:5-10`), and Yarn 4 does not run a `prebuild` script automatically.
* **Action:** Add `yarn survey:validate`, called directly from `build`, with errors naming the file, question, rule and fix. Add a preview listing every path and its question count. Compare each file against last year's, with an explicit marker for editorial changes.

**M28. Version one is too large for a tool used once a year**
* **Lenses:** Zoom-out, Design
* **Risk:** The concept has about nine separate parts, no go-live date, and a volunteer team. Showing results during the survey drives the daily job, the unlock, "How you compare", analyst sign-in and participation progress.
* **Action:** Limit version one to the survey, tracked links, submit API, invitation script and one reviewed release after close. Publish shareable results as a public page, email volunteer results before deleting invite data, and share the analyst report through district Google Workspace. Respondents lose the instant reward. See decision 2.

**M29. A general routing engine may be more than the survey needs**
* **Lenses:** Zoom-out
* **Risk:** The stated need is simple: the section selects a path, and adult roles combine blocks with duplicates removed.
* **Owner decision:** Each question declares which tags make it visible (decision 10).
* **Action:** Keep the rule language limited to all, any and none of a list of tags, so every path can be checked at build time.

**M30. AlignUI should not be the first build task**
* **Lenses:** Zoom-out, Inventive catalyst
* **Risk:** A survey mostly needs radio buttons, checkboxes, text inputs, buttons and a progress bar. Native controls provide keyboard and screen reader behaviour without the compatibility risk.
* **Owner decision:** Use AlignUI through a local `ui/` folder (decision 11).
* **Action:** Make the first build task a thin working slice: tracked link, routed question, single-transaction submit and completed status, built with the AlignUI Radio, Checkbox, Button and Progress Bar so compatibility is tested on real screens.

### Risks: Nit

**N1. Several colour pairs miss contrast targets** (Comprehension, Design, Inventive catalyst)
Confirm these hand-calculated ratios with a contrast tool, and define error, success and warning colours for both themes.

| Pair | Ratio | Action |
| --- | --- | --- |
| Teal `#088486` text on `#f5f8f8` | 4.22:1 | Use a darker teal for normal text |
| Muted `#66747b` on `#f5f8f8` | 4.52:1 | Passes with almost no margin |
| White on selected `#b78cf2` | 2.61:1 | Use dark text on selected answers |
| Focus `#b78cf2` against button `#7413dc` | 2.80:1 | Offset the focus ring from the button |
| Site border `#dfe7e7` on white | 1.26:1 | Do not reuse for input borders |
| Dark border `#2b3a3e` on `#162226` | 1.38:1 | Do not reuse for input borders |
| `#ed3f23` on white | 3.94:1 | Do not use as error text |
| Site error `#a52323` on `#162226` | 2.22:1 | Do not use in dark mode |

Selected and focus states also share one colour, so they need different shapes.

**N2. The dark-theme logo needs an approved background** (Zoom-out, Comprehension, Design, Inventive catalyst)
The brand checklist rules out white logos on unapproved dark colours (`SITE/Notes/TSA-BRAND-COMPLIANCE-CHECKLIST.md:24`). Use a Scouts Purple or black band unless the owner's brand exception covers this.

**N3. The Network age range differs from the site** (Comprehension)
The concept says 18-24 and the site says 18-25 (`SITE/src/lib/joining-age.ts:9`). Use one range.

**N4. Brand sources disagree** (Structural, Implementation readiness, Comprehension, Design, Zoom-out)
The site leads with teal and declares only weight 400 of Nunito Sans (`SITE/src/index.css:1-6,13`). The style variables use a different secondary colour (`/Users/jacob/Development/district-styles/scss/_variables.scss:3`). Define one set of named survey colours per theme, supply real font weights, and state that the purple lead and 14px cards are deliberate.

**N5. Isolate the UI library and define its test** (Structural, Implementation readiness, Comprehension)
Import components through a local `ui/` folder so a switch to Radix does not touch survey screens. Record each copied component's source, version and licence. Test named components under static export, React 19.3, both themes, keyboard use and screen readers.

**N6. The repository is not ready to publish** (Implementation readiness, Structural)
`../../../.gitignore` does not cover Terraform state, variable files or invite exports. There is no `LICENSE` file, and `APP/package.json:4` is marked private. Fix these and add secret scanning before the first public push.

**N7. Logo supply is undefined** (Implementation readiness, Comprehension)
Official logos are banned from the repository but required on every page. Define how the logo is supplied at build time and what adopters see without one.

**N8. Scaffold defaults need replacing** (Implementation readiness, Comprehension, Design)
The layout loads Geist (`APP/src/app/layout.tsx:2-13`) and dark mode only follows the device setting (`APP/src/app/globals.css:15-20`). The manual switch needs a class-based theme applied before the first paint.

**N9. Release markers are missing** (Codebase details)
Stamp the build ID, survey version and rules version on logs, results files and browser error reports.

**N10. Abuse and cost alerts are unspecified** (Codebase details)
Alarm on unusual open-link volume and Turnstile rejection rates, allow results to be held during review, and add an AWS budget alert.

**N11. "Started" may not earn its place** (Zoom-out, Design)
Keep the status only if a reminder or decision will differ because of it. Do not record "started" on open links, because an unauthenticated counter is easy to inflate.

**N12. The manual theme switch could be dropped** (Zoom-out)
Following the device setting alone would simplify version one. This conflicts with the owner's stated design, so it stays as an option.

### What the review could not confirm

* Live AWS state, including log copying, email sending limits and any organisation-wide audit logging.
* LimeSurvey's capabilities, and AlignUI's licence terms and compatibility with React 19 and Next.js 16.
* AWS, Cloudflare and email scanner behaviour, which rests on reviewers' general knowledge.
* Whether the proposed minimum group sizes leave usable results, because audience sizes are unknown.
* Legal compliance, which the data protection impact assessment and ICO Children's Code check must settle.
* Runtime behaviour. Nothing was built, deployed or run.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Track invited volunteers in DistrictWorkflow as not started, started or completed, separately from their answers.
  * Let a volunteer who already responded on the open link have their tracked invitation completed with a signed receipt.
  * Use opening questions to give each person the right questions, combining overlapping adult roles and asking shared questions once.
  * Provide age-appropriate paths for Beavers, Cubs, Scouts and Explorers, with safeguarding information on every young-person path.
  * Keep responses free of invite UUIDs, invitee IDs, IP addresses and times of day, and store invite UUIDs only in DistrictWorkflow.
  * Show grouped results to people with a completed tracked link, once a question reaches 6 responses and refreshing every 3 responses after that, with rounded percentages and fixed breakdowns.
  * Protect open links with Turnstile and rate limits, and record each response's source.
  * Run a static Next.js site on AWS, managed through Terraform.
  * Support light and dark themes that meet the brand and accessibility requirements.
  * Allow yearly reuse through one survey file per year and separate district settings.
  * Publish the code under the MIT licence, targeting UK Scout districts in version one.
  * Complete a data protection impact assessment and ICO Children's Code check before launch.
* **Out-of-Scope Non-Goals:**
  * Cryptographic proof of privacy against AWS administrators.
  * Updating results on every response, custom filters, or ad hoc queries against individual responses.
  * Showing results to open-link respondents.
  * Switching devices partway through a survey.
  * Sending raw responses to any browser.
  * Showing role combinations in reports.
  * Preventing every duplicate on open links.
  * A hosted service for other districts.
  * AlignUI Pro components.
  * An adoption guide before one real survey has run.

## Alternatives Weighed

Reasons marked "inferred" are not stated in the concept and need the author's confirmation.

* **Google Forms or Microsoft Forms.** Rejected by author: they do not provide completion tracking kept separate from answers, or persona-based question paths. The concept names Google Forms only, so applying this reason to Microsoft Forms is inferred.
* **Cloudflare as the platform.** Not chosen: the owner offered AWS or Cloudflare, and the review proceeded on AWS because the existing Terraform repository already provides the hosting, function and data patterns. Cloudflare already serves some district domains and Turnstile, and the main domain may move there, so this choice needs the owner's confirmation.
* **Blind-signed passes, browser encryption and offline keys.** Rejected by author: the privacy goal is to keep casual analysts from working out who said what, not to provide cryptographic proof against AWS administrators.
* **Truly live results.** Replaced by batched snapshots during ideation: the owner wants results visible as responses come in, to encourage completion, but updating on every response would let people work out individual answers by comparing the page before and after a submission. How often results can safely be released is still open in decision 2.
* **Tracked links for everyone.** Rejected by author: the district holds an email list for volunteers only, so young people and parents use open links (the link to the email list is inferred).
* **district-styles with Bootstrap.** Rejected by author: the survey is built on Tailwind 4 and Radix-based components, and the district-styles colours differ from the survey palette (inferred).
* **AlignUI Pro.** Rejected by author: its licence bans publishing in public repositories, and this project publishes its code.
* **Light mode only.** Rejected by author: the survey should follow the person's device setting, and the owner accepts bending brand guidelines for dark mode (inferred).
* **LimeSurvey.** Rejected by author: the district does not have the budget for it, and building the tool is the chosen route. No product test was run.

## Key Decisions & Staging for Next Steps

### Owner decisions

| # | Decision | Recommendation | Basis | Resolves |
| --- | --- | --- | --- | --- |
| 1 | Build or adopt? | **Decided: build.** LimeSurvey is rejected on budget, and no product test will be run. | Owner decision, 2026-11-18. | B3 |
| 2 | When are results released? | **Decided: each question's results become available once that question reaches 6 responses.** This minimum replaces the earlier 10 and 20. Results then refresh every 3 further responses (6, 9, 12 and so on). The owner considers the survey content low in sensitivity and accepts the higher risk of inference. | Owner decision, 2026-11-18, overriding the review's recommendation of few fixed releases. | B1, B4, M11, M28 |
| 3 | Do young people get comment boxes? | **Decided: Scouts and Explorers get comment boxes. Beavers and Cubs do not.** The launch conditions in B2 apply. | Owner decision, 2026-11-18, overriding the review's recommendation of no young-person free text. | B2 |
| 4 | Is switching devices supported? | **Decided: no.** Use browser-only drafts with the limits in M7, and say on the start screen that the survey must be finished on the same device. | Owner decision, 2026-11-18, matching the recommendation of five lenses. | M7 |
| 5 | How much does the submit path log? | **Decided: the approved field list in B8, with metric alarms.** A test fails the build if any other field is logged. | Owner decision, 2026-11-18, matching the recommendation of Codebase details and Structural. | B8, B9 |
| 6 | How are duplicates and bad responses handled? | **Decided: each response stores a random idempotence key and the submission date only, with no time of day and no batch label.** The key is generated in the browser, never derived from the invite UUID, and accepted only once. Bad responses are removed by whole days. DistrictWorkflow's completion times therefore cannot be matched to a response more closely than the day. Analysts and published results never see the key or date. | Owner decision, 2026-11-18, replacing the concept's rule of no dates on responses. | B7, M1, M11 |
| 7 | Reuse the CloudFront module or write a new one? | **Superseded by the design: see "Changes from the Concepts Brief" in `docs/designs/district_survey.md`.** **Decided: a separate, small distribution for the survey**, with access logs off, security headers on and results in a separate private bucket. Set `trailingSlash: false` so sub-pages work with clean address rewrites. | Owner decision, 2026-11-18, matching the recommendation of Structural, Design, Implementation readiness and Inventive catalyst. | M2, M3 |
| 8 | Where does the Terraform module live, and how is it deployed? | **Decided: a self-contained module lives in the public survey repository, and the root Terraform in `DistrictInfrastructure` imports a pinned release.** It shares the existing state. The survey repository's own pipeline deploys the website and Lambda code, so urgent fixes do not wait for a whole-estate apply. | Owner decision, 2026-11-18, overriding the review's recommendation of separate state. | B10, M8 |
| 9 | Who chases and tracks volunteers? | **Superseded by the design: see "Changes from the Concepts Brief" in `docs/designs/district_survey.md`.** **Decided: DistrictWorkflow chases and tracks volunteer responses.** Each invitation is a DistrictWorkflow task with a signed link containing a random UUID, and DistrictWorkflow is the only system that stores the UUID. After saving a response, the submit Lambda immediately sends the UUID to an SQS queue, and DistrictWorkflow completes the task. Survey answers never enter DistrictWorkflow, so its existing `response_requests` feature is not used. If the SQS send fails, the browser retries with the same idempotence key, which sends the message again without saving a second response. DistrictWorkflow's production deployment needs confirming. | Owner decision, 2026-11-18, replacing the review's counts-only recommendation. | B5, M14, M17 |
| 9a | How is repeat use prevented, and can an open-link response count for a tracked invitation? | **Superseded by the design: see "Changes from the Concepts Brief" in `docs/designs/district_survey.md`.** **Decided: signed completion receipts and a one-way used-link record.** After an adult submission, the server returns a signed random receipt, stored in local storage and never stored with the response. When a tracked link opens on that device, the person confirms that they have already responded. The Lambda then marks the receipt and link as used and sends the SQS completion message without creating a response. Each receipt can tick off one link only. Used links and receipts are stored only as one-way values, with no date or response ID, and are deleted at close. If the person did not choose the Volunteer role on the open link, an optional step offers the volunteer questions afterwards. Young-person paths do not save receipts. | Owner decision, 2026-11-18. | M1, M7, M14 |
| 9b | Which personas can use the open link? | **Decided: one open link offers every persona, including Volunteer**, because some volunteers will find it through Facebook or general emails. The first question separates young people from adults, keeping young people exclusive of adult roles. Open-link volunteers are self-declared, and each response keeps its tracked or open source label. Volunteer-only results stay tied to tracked links. | Owner decision, 2026-11-18, replacing the rule that Volunteer is available only through a tracked link. | B6, M19, M23 |
| 9c | Who can see results? | **Superseded by the design: see "Changes from the Concepts Brief" in `docs/designs/district_survey.md`.** **Decided: only people with a completed tracked link.** Open-link respondents do not see results. On completion, the server issues a signed, expiring results pass holding only the survey ID and access level, with no UUID. The results API checks the pass, so viewing leaves no record of who viewed and still works after invite data is deleted. Results are stored in a private bucket and served only through that API. | Owner decision, 2026-11-18, replacing shared public results and the separate volunteer tier. | B4, M26, M28 |
| 10 | How is routing built? | **Decided: question-level logic driven by tags.** A survey has ordered blocks, and blocks have ordered questions. Answer options set tags such as personas and cohorts, and each question shows or hides based on those tags. Conditions are limited to all, any and none of a list of tags. One shared TypeScript function works out the visible questions for the browser and a Node submit Lambda, and the server recalculates tags from the submitted answers. Any earlier question may set tags. The build validates the dependency order, unknown tags, impossible conditions and every possible path, and fails if the number of routes or the longest route exceeds a set limit. Progress is shown by block and recalculated when tags change. | Owner decision, 2026-11-18, replacing persona-level block lists. | B6, M24, M27, M29 |
| 11 | Which UI approach is used? | **Decided: AlignUI free Base Components across survey screens and dashboards**, imported through a local `ui/` folder so any component that fails can be replaced without changing the screens. | Owner decision, 2026-11-18, overriding the review's preference for native controls. | M30, N5 |

### Open items and owners to assign

* Go-live date and audience sizes, which are needed for M5 and M20.
* Reporting breakdowns beyond persona and section.
* The definition of started on open links, and whether "started" stays at all.
* Young Leader questions, whether Squirrels take part, and the Network age range.
* Who approves shareable questions.
* The named comment reviewer and deputy for Scouts and Explorers comments, their review deadline, and the escalation procedure.
* Who reviews comments on adult paths.
* How parents, carers and young people hear the outcome, given that open-link respondents do not see results.
* The primary and deputy responders during the survey.
* A named maintainer and backup for the code.
* Who can see named status in DistrictWorkflow.
* DistrictWorkflow's production deployment and its bounce monitoring.

### Staging

| Stage | Work | Exit condition | If it fails |
| --- | --- | --- | --- |
| 0. Prepare | Gather membership counts, confirm DistrictWorkflow's production deployment, name the comment reviewer and deputy, and start the data protection assessment and Children's Code check. | The remaining Blockers have agreed answers and owners. | Reduce scope. |
| 1. Technical proof | Build the thin working slice, and prove page addresses, browser security rules, signed links, AlignUI compatibility and the SQS message that completes a DistrictWorkflow task. | All five work on a deployed test site. | Change the approach before building features. |
| 2. Non-production | Deploy the separate stack, and test retries, version mismatches, alarms and disclosure attacks with made-up data. | All tests pass and every alarm has fired once. | Destroy the test stack. |
| 3. Pilot | Run a pilot under a separate survey ID. | Results, suppression and log checks pass. | Delete the pilot data. |
| 4. Governance | Complete the assessments, name the responders and confirm the live log-copying state. | Sign-off is recorded. | Do not open the survey. |
| 5. Tracked links | Send to volunteers first. | Status and reminders work correctly. | Close tracked links. |
| 6. Open links | Open the young-person and adult links. | Abuse controls hold under real use. | Close open links only. |
| 7. Close and delete | Verify the final results and send the final results link through DistrictWorkflow. Then delete used-link and receipt records, their secrets and the invite UUIDs in DistrictWorkflow, and keep the evidence. | Deletion is confirmed across every data store. | Republish the last good results. Deletion cannot be reversed, so verify first. |
| 8. Adoption | Review the first survey, then write the adoption guide. | A second district could follow the guide. | Revise the guide. |
