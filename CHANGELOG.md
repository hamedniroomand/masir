# Changelog

## 2.0.0

### Major Changes

- [#18](https://github.com/hamedniroomand/masir/pull/18) [`9dfb121`](https://github.com/hamedniroomand/masir/commit/9dfb121ecb15e06ab426d4ebe8d5d1a89ff9939c) - ### Removed
  
  - The demo workspaces, `POST /api/auth/demo`, and `NUXT_DEMO_ENABLED`.
  - The in-app landing page. The documentation site is the public home page.
  - Public registration, `/register`, `POST /api/auth/register`, and
    `NUXT_ALLOW_REGISTRATION`. New users join through an invitation.
  - Turnstile and `NUXT_PUBLIC_TURNSTILE_SITE_KEY` and `NUXT_TURNSTILE_SECRET_KEY`.
  - The `demosDeleted` field of `POST /api/jobs/alerts`.

- [#18](https://github.com/hamedniroomand/masir/pull/18) [`ff200ba`](https://github.com/hamedniroomand/masir/commit/ff200ba5785adb8aeca4676fee04a68a8f7fd546) - ### Added
  
  - An invite link creates the account for a new teammate. The teammate sets a
    password on the invite page. `GET /api/workspaces/invitations/preview`
    returns the workspace name and the invited email.

- [#18](https://github.com/hamedniroomand/masir/pull/18) [`ae9abc5`](https://github.com/hamedniroomand/masir/commit/ae9abc53ede998ca86a32b69a02c7ba8383cf8b3) - ### Removed
  
  - Multi-workspace mode, workspace subdomains, and the workspace switcher. One
    install serves one workspace. Short links on workspace subdomains stop
    working. Short links on `NUXT_PUBLIC_SHORT_DOMAIN` keep working.
  - `POST /api/workspaces`, `DELETE /api/workspaces`, and
    `GET /api/workspaces/slug-available`.
  - `NUXT_DEPLOYMENT_MODE`, `NUXT_MULTI_WORKSPACE`, `NUXT_APP_DOMAIN`,
    `NUXT_SESSION_COOKIE_DOMAIN`, and `NUXT_RATE_LIMIT_WORKSPACE_PER_DAY`, and
    `NUXT_RATE_LIMIT_SLUG_CHECK_PER_MINUTE`. The app ignores them when they are
    set.
  - The `multiWorkspace` field of `GET /api/workspaces`.
  - The `/no-access` page is new, so `no-access` is now a reserved slug. A short link or link prefix named `no-access` stops working. Rename it before the upgrade.

- [#18](https://github.com/hamedniroomand/masir/pull/18) [`0058c9d`](https://github.com/hamedniroomand/masir/commit/0058c9d10acf6f559f56c690f475e5b0c018497d) - ### Removed
  
  - Google and Microsoft sign-in, the `/api/auth/identities` routes,
    `GET /api/auth/providers`, the account settings page, and the five
    `NUXT_OAUTH_*` variables. A user who signed in only with a provider uses
    "Forgot password" to set a password.
  - Email verification, `/verify-email`, and the `/api/auth/verify` routes. An
    invitation proves the email address.

- [#18](https://github.com/hamedniroomand/masir/pull/18) [`073d52f`](https://github.com/hamedniroomand/masir/commit/073d52f7e231656923b9b6f174dfc9b5a2b3128c) - ### Removed
  
  - Vercel and serverless deployment, `vercel.json`, and `NUXT_SERVERLESS`.
    Run Masir with Docker or Bun on a server.

- [#18](https://github.com/hamedniroomand/masir/pull/18) [`1d4fc97`](https://github.com/hamedniroomand/masir/commit/1d4fc9779fff3c442788e997f7ae328b3c5b0188) - ### Upgrade notes
  
  - Back up the database before the upgrade. The 2.0 migration deletes data,
    and Masir has no down migrations.
  - Masir 2.0 serves one workspace. The migration stops when more than one live
    workspace exists. On 1.x, keep one workspace and delete the others. Stay on
    1.x if you need several workspaces.
  - A demo workspace counts as live until 1.x deletes it. Delete demo workspaces before the upgrade.
  - The migration permanently deletes soft-deleted workspaces with their links,
    Google and Microsoft sign-in records, and email verification tokens.
  - Stop every instance before the upgrade. 1.x code does not work against the
    2.0 schema, so a rolling deploy is not supported for this release.
  - You can delete the removed environment variables. The app ignores them.
  - The `x-vercel-ip-country` fallback is gone. Set `NUXT_GEO_COUNTRY_HEADER` if your proxy sends the country in another header.
  
  ### Changed
  
  - The 2.0 migration drops the workspace plan, trial, subscription, demo
    expiry, and deletion columns, and the user email verification and avatar
    columns.

### Patch Changes

- [#21](https://github.com/hamedniroomand/masir/pull/21) [`d46315f`](https://github.com/hamedniroomand/masir/commit/d46315f99d37dfbda5363346724e6bdb4ada881d) - `GET /api/admin/status` reports the version from `package.json`. It reported `1.0.1` for every release before.

- [#16](https://github.com/hamedniroomand/masir/pull/16) [`076981b`](https://github.com/hamedniroomand/masir/commit/076981bf38ee5ebbbdbe684c77d48b45a1dd95fc) - The documentation site moves to `https://docs.masir.dev/`. The old `hamedniroomand.github.io/masir` address redirects to it.

All notable changes to Masir are listed here. Changesets writes new sections. The
project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

A release that needs an action from you has an **Upgrade notes** block. Read
the notes for every version between the one you run and the one you install.

## [1.1.0] - 2026-09-27

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

- Removed the routing preview from link detail and link creation.
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

### Fixed

- Campaign detail now opens the shared link creation drawer with its campaign selected.
- Campaign detail and analytics responses now report current link counts. The
  campaign list refreshes after link assignments change.

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
