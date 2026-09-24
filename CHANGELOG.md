# Changelog

All notable changes to Masir are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

A release that needs an action from you has an **Upgrade notes** block. Read
the notes for every version between the one you run and the one you install.

## [Unreleased]

### Added

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
