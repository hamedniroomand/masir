# Changelog

All notable changes to Masir are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every release that needs an action from the operator has an **Upgrade notes**
block. Read them for every version between yours and the one you install.

## [Unreleased]

### Added

- Links with slugs, destinations, tags, schedules, passwords, and expiry
- Campaigns with UTM defaults
- Workspaces, members, roles, and invitations
- Password, Google, and Microsoft sign-in with email verification; an account password needs at least 8 characters with at least 1 number and 1 sign, and the register and reset forms show the rules as you type
- Login and register pages show only the configured sign-in providers first; a link reveals the email and password form
- Click analytics without IP storage
- Self-hosted and multi-workspace deployment modes
- Compatibility rules, this changelog, and the upgrade guide
- Development stack in `compose.dev.yaml` with hot reload and Mailpit
- VS Code dev container that opens the development stack
- `MASIR_APP_PORT`, `MASIR_DB_PORT`, `MASIR_MAIL_SMTP_PORT`, and
  `MASIR_MAIL_UI_PORT` to move a published host port
- `uploads` volume in the production stack, so logos survive a recreate
- `masir_test` database in the development stack, and `TEST_DATABASE_URL` to
  move the tests to another server
- `bun run test` starts the db service and waits for it
- Browser tests with Playwright, one project per deployment shape
- `NUXT_SESSION_COOKIE_SECURE` for an instance served over plain http

### Changed

- Postgres 18 is the minimum. Every primary key defaults to the native
  `uuidv7()`.
- Member routes address a member by user id. `PATCH` and `DELETE` on
  `/api/workspaces/members/<id>` take the user id, and the member list answers
  with `userId`.
- The transfer ownership body field is `userId`, not `memberId`.
- The link analytics response drops `classificationAvailableFrom` and
  `periodCoversLegacy`. Every breakdown label is a string.
- The admin route `/api/admin/security-events` is now
  `/api/admin/audit-events`, and its rows carry `actorId` and a JSON `detail`.
- Deleting a link keeps its slug and its click history. The slug stays taken in
  that workspace.
- A link with a campaign cannot carry its own `utm_campaign`. The create and
  update routes answer 400.
- Inviting an address that already has an open invitation answers 409.
- Application pages render on the client only. The server renders the visitor
  error page behind a short link, so previews and crawlers read it without
  JavaScript.
- The production compose file is now `compose.yaml`. It requires
  `POSTGRES_PASSWORD`, no longer publishes the Postgres port, restarts its
  services, and no longer starts the Mailpit catcher. Set `NUXT_MAIL_*` for a
  real provider, or messages go to the log.
- A new workspace starts on the `active` plan in every deployment mode. No
  trial starts and nothing expires. `NUXT_TRIAL_DAYS` is gone, and the create
  workspace response no longer carries `trialEndsAt`. The `plan`,
  `trial_started_at`, `trial_ends_at`, and `subscription_status` columns stay
  for a later billing feature.

### Fixed

- A refused form shows the reason the server gave, not the generic HTTP text.
  A link, a campaign, and a toast all read the reason from the response body
- The sidebar and the workspace settings page show the workspace the host
  names, not the first membership; the root host of a multi-workspace instance
  goes to the workspace chooser
- A short link that does not exist, or a slug on a host without a workspace,
  answers 404 again instead of the application shell
- The test servers no longer inherit the developer's `.env`, which made the
  suite fail on a machine with `NUXT_MULTI_WORKSPACE=true`
- Ship the migration files in the Docker image, so migrate-on-boot finds them
- The app health check in compose used curl, which the image does not have
- `bun run db:seed:admin` and `db:migrate` failed inside the production image;
  the scripts now ship in it as bundles

- Refuse to delete the only workspace of an instance
- Revalidate form fields after the first failed submit
