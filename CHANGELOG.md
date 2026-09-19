# Changelog

All notable changes to Masir are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

A release that needs an action from you has an **Upgrade notes** block. Read
the notes for every version between the one you run and the one you install.

## [Unreleased]

### Added

- Read-only **Viewer** role. A viewer reads links, campaigns, and analytics and
  changes nothing. Invitations and the member row carry the role.
- Private notes on a link, at most 2000 characters. Link search matches them.
- Fallback destinations for a used-up visit cap and for a link that has not
  started. Both are recorded as their own outcome and count no click.
- Device and country targeting. One link can send iOS, Android, desktop, and up
  to 20 countries to their own destination.
- Slug rename and up to 10 extra addresses for each link. An address that once
  worked stays reserved, even after a rename or a delete.
- The create form warns when a destination already has a link. It never blocks
  the second one.
- Quick create at `/links/new`, with a bookmarklet in the workspace settings.
- Workspace **Overview** page at `/dashboard`, with totals, a timeline, the top
  five links, and the links that need attention. Sign-in lands there. The link
  list stays at `/`.
- Email alerts before a link reaches its visit cap or expires, with
  `NUXT_ALERTS_INTERVAL_MINUTES`, `NUXT_JOBS_SECRET`, and
  `POST /api/jobs/alerts` for a serverless deployment.

### Changed

- The nine workspace read routes ask for the new `links.read` permission
  instead of `links.manage`. Owners and members keep both.

### Upgrade notes

- During a rolling deploy an old instance does not know the `viewer` role. A
  person the new code just made a viewer gets a `500` from an old instance until
  every instance runs the new version. Wait for the deploy to finish before you
  add viewers.
