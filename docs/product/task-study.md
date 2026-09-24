# Release 2 task study

> Check the Release 2 flows the PRD measures.

This study covers the four moderated tasks from PRD §3. The browser fixtures in
`test/browser/single/task-study.spec.ts` encode the three-channel launch and the
import retry path for CI. Run the human tasks with real pilots. Use the browser
fixtures as the automated baseline only.

## Goal

Measure whether a workspace member can:

1. Create and copy a first link without help.
2. Create newsletter, social, and print links for one campaign destination.
3. Classify 20 links in bulk faster than individual edits.
4. Explain period, lifetime, and unique counts on a report.

## Recruitment

| Criterion | Requirement |
|---|---|
| Teams | At least six pilot teams (startups, companies, and agencies) |
| Role | Active workspace member or owner with `links.manage` for creation tasks; `links.read` or `analytics.read` for the report task |
| Experience | Include users with limited technical experience; use their actual link tasks |
| Count | At least 5 participants for the moderated session; prefer one per pilot team |
| Session length | About 45 minutes for all four tasks |
| Environment | Single-workspace deployment on a desktop browser |

Do not recruit viewers for Tasks 1–3. Viewers cannot create, batch, or classify
links. Viewers may run Task 4 when they have analytics access.

## Targets (PRD §3)

| Measure | Definition | Target |
|---|---|---|
| First-link completion | A new user creates and copies a valid link without help | At least 80% in a moderated task study |
| Time to first link | Time from the first creation screen to copied result | Median below 2 minutes in the same study |
| Campaign completion | A user creates links for three channels without help | At least 80% in a moderated task study |
| Bulk task time | Time to classify 20 links | At least 50% lower than the current individual-edit flow |
| Report comprehension | A user correctly explains period, lifetime, and unique counts | At least 80% in a moderated task study |

Record task completion, time, errors, and requests for help on the results
sheet below.

## Tasks

### Task 1 — First link

1. Sign in as a new or low-experience member.
2. Open the link creation screen.
3. Enter a destination URL and create the link.
4. Copy the short URL from the success state.

Success: the participant creates a valid link and copies the result without
help. Record elapsed time from the creation screen to the copy action.

### Task 2 — Three-channel launch

1. Open a campaign.
2. Choose **Create links in this campaign**.
3. Enter one destination URL.
4. Confirm the newsletter, social, and print rows show the campaign UTM values.
5. Choose **Create links**.
6. Confirm each row shows a created short URL.

Success: three links exist under the campaign, one per channel preset, without
manual URL editing.

### Task 3 — Classify 20 links

1. Prepare or select 20 links that need the same campaign or tags.
2. Open the link library.
3. Select the 20 links.
4. Apply the campaign or tags with bulk actions.
5. Confirm the library shows the new classification.

Success: all 20 links carry the intended campaign or tags. Record elapsed time
and compare it with the same work done by editing each link alone.

### Task 4 — Explain a report

1. Open a link, campaign, or workspace report that has traffic.
2. Ask the participant to explain **period clicks**, **lifetime clicks**, and
   **unique visitors** in their own words.
3. Ask which traffic class and date range the numbers use.
4. Confirm the explanation matches the definitions on the report.

Success: the participant correctly explains period, lifetime, and unique counts
without coaching.

### Supporting fixture — Import with retry

CI also covers CSV import recovery (PRD import-recovery measure). It is not one
of the four moderated tasks above.

1. Open **Import** from the link library.
2. Upload a CSV with at least two valid rows.
3. Choose **Preview**, then **Import valid rows**.
4. When one row fails, confirm the page shows **Retry failed rows**.
5. Choose **Retry failed rows**.
6. Confirm the failed row becomes created and the earlier success stays created.

Success: every intended row is created, and a retry does not recreate rows that
already succeeded.

## Protocol

1. Share the recruitment table, targets, and the task list with the participant.
2. Ask the participant to think out loud.
3. Do not guide the clicks unless the participant is blocked for more than two
   minutes.
4. Record pass, fail, or blocked for each task. Record elapsed time for Tasks 1
   and 3.
5. Note one short observation per task.
6. For Task 3, also run the individual-edit baseline once so the 50% reduction
   target can be checked.

## Recording sheet

| Field | Value |
|---|---|
| Participant | |
| Team type | startup / company / agency |
| Date | |
| Role | |
| Technical experience | limited / moderate / high |
| Environment | |

## Results

| Participant | Date | Task 1 | Time 1 | Task 2 | Task 3 | Time 3 (bulk) | Time 3 (edit) | Task 4 | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Browser fixture | 2026-09-24 | — | — | Pass | — | — | — | — | Automated three-channel + import retry in `test/browser/single/task-study.spec.ts` |

Add one row per human participant. Keep the fixture row as the CI baseline.
Mark Task 1–4 cells Pass, Fail, or Blocked. Leave time cells blank when the
task was not run.
