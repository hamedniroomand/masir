# Changelog

All notable changes to Masir are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

A release that needs an action from you has an **Upgrade notes** block. Read
the notes for every version between the one you run and the one you install.

## [Unreleased]

### Added

- Optional Umami analytics for application page views.
  `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_WEBSITE_ID` turns it on with Umami
  Cloud. `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_HOST_URL` points it at a
  self-hosted Umami. `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_REPLAYS=true` also
  loads the Umami recorder for replays and heatmaps. Short-link visitor
  responses do not load either script.

### Changed

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
