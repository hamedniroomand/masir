# Changelog

All notable changes to Masir are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

A release that needs an action from you has an **Upgrade notes** block. Read
the notes for every version between the one you run and the one you install.

## [Unreleased]

### Fixed

- Routing preview country select no longer crashes when the first item (No country)
  is selected. Empty-string SelectItem values are replaced with a sentinel.

- Date pickers in routing preview and analytics custom range use the Nuxt
  Calendar component instead of native browser date inputs.

- Routing preview fields align on the same baseline when one field has helper
  text and siblings do not.

### Added

- Release 2 task study for the four PRD §3 tasks (first link, three-channel
  launch, classify 20 links, explain a report), with recruitment criteria,
  targets, recording sheet, and results table in `docs/product/task-study.md`.
  Browser fixtures cover three-channel launch and CSV import retry.

- Analytics CSV download for link, campaign, and workspace reports.
  `GET /api/links/:id/analytics.csv`, `GET /api/campaigns/:id/analytics.csv`, and
  `GET /api/workspaces/analytics.csv` reuse the JSON range filters (`period` or
  `from`/`to`, optional `compare=previous`, plus `traffic` / `attribution`).
  Each file starts with a definition header (`key`, `label`, `definition`, `value`)
  for metrics and report meta, then a `bucket,count` series, then breakdown
  rows (`section,label,count`) and workspace/campaign top links
  (`slug,title,clicks`). The value-bearing header is kept instead of a
  `# metric,definition,range,traffic` comment line so totals sit next to their
  definitions; range and traffic stay in meta rows. Report views add a
  Download CSV button. Totals match the JSON routes. Notes and link ids are
  never included. Formula-like cells stay prefixed by the shared CSV writer.

- Custom analytics ranges, previous-period comparison, and report metadata.
  Link, campaign, and workspace analytics accept `from`/`to` (`YYYY-MM-DD`, UTC,
  inclusive start, exclusive end, max 366 days) or `period` (not both).
  `compare=previous` returns `previous` scalars and `change` with `percent: null`
  when the previous value is 0. Custom-range `meta` includes timezone, boundaries,
  traffic, attribution, `earliestEventAt`, `signals`, and a warning when `from`
  is before retained partitions. The three report views add a range picker,
  comparison toggle, metadata line, and "No prior data" when percent is null.

- Routing preview for authorized members. `POST /api/links/:id/preview` runs
  `decideRedirect` with a simulated country, device, and time. It does not
  consume visits, write events, set a password cookie, or touch the link cache.
  The link overview and create-success state show `LinkRoutingPreview`.

- Link trash, restore, and undo. `GET /api/links?trashed=true` lists soft-deleted
  links. `POST /api/links/:id/restore` clears `deleted_at`, invalidates the slug
  and aliases, and writes `link_restored`. The library adds a Trash view with
  restore. Archive, unarchive, and delete show an Undo toast. Purge does not
  exist in this version.

- Link responsibility, review date, and archive. `links` gains
  `responsible_user_id`, `review_at`, and `archived_at`. Patch accepts
  `responsibleUserId`, `reviewAt`, and `archived`. List filters add working
  `archived` and `needsReview`. Bulk `archive` is available. Member removal
  clears responsibility. Audit events: `link_responsible_changed`,
  `link_archived`, `link_unarchived`. `GET /api/workspaces/members/options`
  lists active members for link editors who assign responsibility.
- CSV link import and export. `POST /api/links/import/preview` and
  `POST /api/links/import` create links from a CSV with preview errors and
  idempotent retries. `GET /api/links/export.csv` downloads the current library
  filters. Template at `/templates/links-import.csv`.
- Library filters for `campaignId`, `createdBy` (`me` or a user id), and
  `archived` (default `false`) on `GET /api/links` and `listLinks`.
- `POST /api/links/bulk` for tag, untag, and assign-campaign actions on a set
  of ids or on a filter (cap 500). Cross-workspace ids answer 404. One audit
  event `links_bulk_action` is written per request.
- Link library selection, campaign and creator filters, a searchable tag menu
  above 15 tags, the **My links** view, and custom views in localStorage.

- Shared CSV parse and write helpers in `shared/csv.ts` with formula-safe cells, plus `csvResponse` for download responses.
- A link-level `utm_medium` override. A link value wins over its campaign
  medium; clearing it returns to the campaign value.
- `POST /api/links/batch` creates up to 20 links from one destination in one
  request. Each row carries its own `utmSource`, `utmMedium`, `utmContent`, and
  optional `slug`. The create rate limit is charged once per item. An empty
  `items` list is refused. On a validation error the whole batch is refused
  with 422 and `rows` listing each failed row. Each created link writes the
  same `link_created` audit event as a single create. Channel presets live in
  `shared/channel-presets.ts`.
- Optional Umami analytics for application page views.
  `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_WEBSITE_ID` turns it on with Umami
  Cloud. `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_HOST_URL` points it at a
  self-hosted Umami. `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_REPLAYS=true` also
  loads the Umami recorder for replays and heatmaps. Short-link visitor
  responses do not load either script.
- A job runner for maintenance work, with a new `job_runs` table. A database
  lock makes sure that each job runs one time for each due time, also when
  many instances run it at the same time. `POST /api/jobs/alerts` also returns `jobs`, one
  report for each job.
- A `click_event_partitions` job, fixed at every 24 hours, keeps
  `click_events` inserts working on an instance that never restarts. Its job
  report includes `partitionsReadyThrough`.
- A `service_signals` table and operational signal reporting. When a background
  event write fails, the redirect reports the error without delay and sets
  the `event_write` signal to `failed`. A subsequent successful insert resets
  the signal to `ok`.
- A restricted operator status endpoint `GET /api/admin/status` and page
  `/settings/status` for viewing maintenance jobs, service signals, and
  partition boundaries. `NUXT_OPERATOR_EMAILS` configures authorized user
  emails.
- An attribution snapshot on `click_events` (`campaign_id`, `attribution_version`,
  `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) with a partial index
  on `(campaign_id, created_at)`. Successful redirects snapshot effective UTM
  parameters and campaign ID at click time.
- Attribution mode selection (`current` vs `recorded`) on campaign analytics via
  `GET /api/campaigns/:id/analytics?attribution=...`. Recorded mode scopes to
  clicks recorded with the campaign at redirect time and groups by snapshot UTM
  values. The response reports `meta: { attribution, legacyCount }`.
- Explicit analytics metric definitions in `shared/analytics-metrics.ts` and response
  metadata (`lifetimeClicks`, `usedVisits`, `meta: { timezone, period, traffic }`).
  The link analytics panel presents period clicks, lifetime clicks, daily unique visitor
  explanations, remaining visits, loading skeletons, and retryable error states.
- Retained link paths and prefix migration management. When changing a workspace link
  prefix with `pathMode: 'preserve'`, the previous prefix is retained in `workspace_link_prefixes`,
  allowing published URLs and QR codes under the previous path to continue resolving. Retained
  paths can be viewed and revoked under workspace settings.
- Configurable link cache TTLs (`NUXT_LINK_CACHE_TTL_SECONDS`,
  `NUXT_LINK_CACHE_MISS_TTL_SECONDS`) and shared invalidation across instances
  using Redis pub/sub (`NUXT_LINK_CACHE_SHARED_INVALIDATION`). A failed or
  disconnected Redis connection sets the `link_cache` operational signal to
  `degraded`.
- QR code preview fidelity, client-side PNG rasterization matching SVG styling and logo,
  and scanner contrast ratio warnings.
- Release 1 verification test fixtures for published address migration compatibility and
  attribution history, along with redirect latency benchmark script (`scripts/bench-redirect.ts`).



### Changed

- Redirect decision logic is extracted into a pure `decideRedirect` function in
  `shared/redirect-decision.ts`. The redirect middleware now uses pure decisions
  for targeting rules, expiration, schedules, limits, and password gates.
- Boot prepares the current month and the next two `click_events` partitions,
  up from the next one.
- The internal loop checks every minute for due jobs and runs the first check
  30 seconds after boot. When the loop is on, `POST /api/jobs/alerts` runs
  only the jobs that are due. A failed job no longer stops the other jobs. The
  route still returns `500` after a failure.
- The app and documentation site now include branded social preview images for
  Open Graph and X cards.
- The documentation site now has task-based navigation for product users,
  operators, API users, and contributors. Every published page and the
  VitePress theme were rewritten for the first public release.
- The Docker image ships with Sentry compiled in and off. `NUXT_PUBLIC_SENTRY_DSN`
  turns it on at run time, with no rebuild. With `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, and `SENTRY_PROJECT` the container also creates the release
  and uploads the source maps of its own build to your Sentry when it starts.
  The maps travel inside the image and stay out of the directory the server
  publishes. Compose no longer takes the Sentry build arguments or the
  `sentry_auth_token` build secret.
- Sentry now starts only with a DSN. `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
  `SENTRY_PROJECT`, and `SENTRY_URL` upload source maps and no longer turn
  error reporting on by themselves.
- `NUXT_PUBLIC_SENTRY_RELEASE` defaults to the version of the image.

## [1.0.1] - 2026-09-20

### Fixed

- Compose hands `POSTGRES_PASSWORD` to the app as `PGPASSWORD`, outside the
  connection string. A password with `%` or another URL character no longer
  stops the app at boot with `URIError`. Any character works now, except `$`,
  which `.env` needs as `$$`.
- Google Analytics hits go to Google directly. The first-party proxy answered
  `500` on every hit, because Bun's `undici` has no `Agent.close()`.

## [1.0.0] - 2026-09-20

First release.
