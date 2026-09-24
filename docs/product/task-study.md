# Release 2 task study

> Check that campaign batch launch and CSV import retry work for real users.

This study covers the Release 2 flows that create several links at once. The
browser fixtures in `test/browser/single/task-study.spec.ts` encode the same
tasks for CI.

## Goal

Measure whether a workspace member can:

1. Create newsletter, social, and print links for one campaign destination.
2. Import a CSV, see a failed row, and retry only that row.

## Recruitment

| Criterion | Requirement |
|---|---|
| Role | Active workspace member or owner with `links.manage` |
| Experience | Has created at least one Masir link before the session |
| Count | At least 5 participants |
| Session length | About 20 minutes |
| Environment | Single-workspace deployment on a desktop browser |

Do not recruit viewers. Viewers cannot import links or create batch links.

## Tasks

### Task 1 — Three-channel launch

1. Open a campaign.
2. Choose **Create links in this campaign**.
3. Enter one destination URL.
4. Confirm the newsletter, social, and print rows show the campaign UTM values.
5. Choose **Create links**.
6. Confirm each row shows a created short URL.

Success: three links exist under the campaign, one per channel preset.

### Task 2 — Import with retry

1. Open **Import** from the link library.
2. Upload a CSV with at least two valid rows.
3. Choose **Preview**, then **Import valid rows**.
4. When one row fails, confirm the page shows **Retry failed rows**.
5. Choose **Retry failed rows**.
6. Confirm the failed row becomes created and the earlier success stays created.

Success: every intended row is created, and a retry does not recreate rows that
already succeeded.

## Protocol

1. Share the recruitment table and the task list with the participant.
2. Ask the participant to think out loud.
3. Do not guide the clicks unless the participant is blocked for more than two
   minutes.
4. Record pass, fail, or blocked for each task.
5. Note one short observation per task.

## Results

| Participant | Date | Task 1 | Task 2 | Notes |
|---|---|---|---|---|
| Browser fixture | 2026-09-24 | Pass | Pass | Automated in `test/browser/single/task-study.spec.ts` |

Add one row per human participant. Keep the fixture row as the CI baseline.
