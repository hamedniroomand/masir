# Masir

Every link has a destination.

Link manager for teams. Create short links, change destinations without changing the URL, and view click analytics.

One codebase serves two shapes. **Self-hosted** holds one workspace on your own
host. **Cloud** holds many, each on its own subdomain. The schema is the same in
both; a flag decides.

## Quick start

Postgres 18 or newer. Every primary key defaults to the native `uuidv7()`,
which arrived in 18.

```sh
git clone <repo>
cd masir
cp .env.example .env
# Edit .env — set NUXT_SESSION_PASSWORD (32+ chars), NUXT_PUBLIC_SHORT_DOMAIN and NUXT_DATABASE_URL
docker compose -f compose.dev.yaml up -d db   # or point NUXT_DATABASE_URL at your own Postgres 18
bun install
bun run db:migrate
bun run db:seed:admin
bun run dev
```

Sign in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The seed makes the
first workspace and its owner together, so the app works at once.

## Workspaces

A workspace owns every link, tag, campaign, and click event. People reach a
workspace through a membership, never directly.

```text
User → Workspace member (role) → Workspace → Links, tags, analytics
```

| | Cloud | Self-hosted |
|---|---|---|
| Workspaces | Many | One, made by the seed |
| Address | `acme.example.com` | Your own host, no subdomain |
| Wildcard DNS | Required | Not needed |
| Registration | Open | Closed by default |

Set `NUXT_MULTI_WORKSPACE=true` for the cloud shape. Leave it false and the
server ignores the hostname and serves its one workspace on any host.

### Roles

Two roles. A workspace holds exactly **one owner**, and a partial unique index
in Postgres refuses a second one.

- **Owner** — workspace settings, invitations, members, ownership transfer, deletion, and everything a member can do.
- **Member** — links, tags, campaigns, analytics.

Only ownership transfer changes who the owner is. Deactivating, removing, or
demoting the owner is refused; transfer first.

### Invitations

The owner invites by email. Every invitation joins as a member and expires
after 7 days. Only the invited address may accept, and the token is stored as a
hash, so a stolen database row cannot be replayed.

### Tenant isolation

Every tenant query carries a workspace. A caller who is not a member gets
**404, never 403**, so the answer never confirms that a workspace exists.
`test/e2e/workspace-isolation.test.ts` holds the proof: workspace A cannot
read, edit, or delete workspace B's link by id, and two workspaces can hold the
same slug.

## Authentication

- Email and password, with verification before any workspace work.
- Google and Microsoft, through `nuxt-auth-utils`. A provider button appears only when that provider has a client id.
- One user may hold several sign-in methods. Linking needs the local email verified already, and the last method cannot be disconnected.
- Password recovery ends **every** session, not only the caller's. A stolen cookie does not survive a password change.

Tokens for verification, recovery, and invitations are all stored hashed,
expire, and work once.

## Subdomains and DNS

Cloud mode needs one wildcard record and one wildcard certificate:

```text
example.com
*.example.com
```

Creating a workspace is a database insert. It calls no DNS or certificate API.

Cross-subdomain sessions need the cookie on the parent domain. Set
`NUXT_SESSION_COOKIE_DOMAIN=.example.com`. Boot refuses to start without it
when `NUXT_MULTI_WORKSPACE` is true, because the alternative is every workspace
quietly asking people to sign in again.

## Billing and limits

Not built. Every workspace starts on `active` and nothing expires, in cloud
mode and self-hosted alike. The `workspaces` table keeps `plan`,
`trial_started_at`, `trial_ends_at`, and `subscription_status` unused, so a
trial, entitlements, or a billing provider needs no schema redesign. Billing
belongs to the workspace, never to the user.

## Environment

See `.env.example` for every variable. Boot fails with the variable name if a
required value is missing or invalid.

The ones that decide the shape of the deployment:

| Variable | Meaning |
|---|---|
| `NUXT_DEPLOYMENT_MODE` | `CLOUD` or `SELF_HOSTED` |
| `NUXT_MULTI_WORKSPACE` | `true` gives each workspace a subdomain and needs wildcard DNS |
| `NUXT_ROOT_DOMAIN` | Origin of the root site, with protocol and port |
| `NUXT_SESSION_COOKIE_DOMAIN` | Required when `NUXT_MULTI_WORKSPACE` is true |
| `NUXT_ALLOW_REGISTRATION` | `true` lets anybody register |
| `NUXT_DATABASE_POOL_MAX` | Connections for one instance. Lower it on serverless |
| `NUXT_MAIL_API_KEY` | Resend key. Empty logs messages instead of sending them |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` | Empty hides that provider's button |

**Self-hosted with registration on** has no way for a new person to reach a
workspace yet, because they can neither be the second owner nor make a second
workspace. Invite them instead, and leave registration closed.

## Architecture

- **Redirect path:** `00.workspace.ts` resolves the workspace from the hostname, then `01.redirect.ts` resolves `/:slug` inside it, before the Vue app loads. One cached read, then `302`.
- **302 not 301:** Destinations stay editable; permanent redirects would be cached by browsers.
- **Cache:** In-memory slug cache (60s TTL), keyed on workspace plus slug, invalidated on edit and delete. Single node only; use a shared store for more.
- **Rate limits:** Counters sit behind a store interface. The built-in store is in memory and counts one process only. Add a shared driver before you run more than one instance.
- **Query passthrough:** The redirect keeps the query a visitor adds to the short link and sends it to the destination.
- **Analytics:** Events are recorded after the redirect decision via `waitUntil`. Read-time aggregation runs in Postgres.
- **Privacy:** No raw IP storage. Country comes from a proxy header (`GEO_COUNTRY_HEADER`, `cf-ipcountry`, or `x-vercel-ip-country`). Default Docker deploy has no country data unless you add a proxy.

## Total clicks

**Total clicks** means the count of successful human redirects. It does not include bots, password failures, or blocked requests.

The link detail page and analytics API use this definition.

## Link lifecycle and status

A link has one status at a time. Precedence runs in this order:

1. **Disabled** — the owner turned the link off.
2. **Expired** — the expiry time passed.
3. **Limit reached** — the visit limit is full.
4. **Scheduled** — the start time is in the future.
5. **Active** — the link can redirect.

Steps:

1. **Create** — random or custom slug; slug is immutable.
2. **Redirect** — middleware lookup, access checks, then `302` or a block page.
3. **Edit** — destination, title, schedule, limits, password, tags, campaign, UTM values; slug unchanged.
4. **Disable / expire / limit / schedule** — the visitor sees a state page or a fallback URL.
5. **Delete** — the row keeps `deleted_at`, so the slug stays taken and the click history stays.

## Password protection

An owner can set a password on a link. The redirect sends the visitor to `/p/:slug`. The visitor enters the password. The server checks it and sets a short-lived signed cookie. The next request to the short link can redirect.

The destination URL is not sent to the browser before the check passes. A view of the password page does not count as a click or a visit. A wrong password does not consume a visit. The verify endpoint is rate limited.

## Maximum visits and one-time links

An owner can set **maximum visits**. Each successful human redirect consumes one visit. Bots do not consume visits. The counter uses an atomic database update under load.

**One-time link** sets maximum visits to `1`. The owner can raise or remove the limit. The used count does not reset when the limit changes.

## Scheduling

**Start time** blocks redirects before that time. **Expiry** blocks redirects after that time. Start must be before expiry.

## Expiration behavior

When a link expires and **expiration destination** is set, the visitor gets a `302` to that URL. The event is recorded as an expired redirect. It does not increase total clicks or visit count.

When no expiration destination is set, the visitor sees the expired page.

## Tagging

Tags belong to an owner. A link can have many tags. A tag can belong to many links. Deleting a tag removes assignments only. Links stay.

The dashboard can filter by tag, search term, and status together.

## Bot detection

The server classifies the user agent as a bot or a human. Bots can still receive redirects for previews. Bot traffic is recorded separately. Bots do not increase total clicks or consume visit limits.

## Unique visitors

Masir estimates unique visitors with a daily hash:

`sha256(serverSecret + dayNumber + linkId + clientIp + userAgent)` (truncated).

The salt joins `NUXT_SESSION_PASSWORD` with the day number. The server secret is necessary: a day number alone is public, so the hash could be reversed by a search of the IP space. The database stores the hash only, not the IP. One visitor counts once per link per 24 hours. A shared IP can merge two people. This is a deliberate privacy trade.

## Analytics definitions

| Metric | Meaning |
|--------|---------|
| Total clicks | Successful human redirects (all time on the link row) |
| Unique visitors | Distinct visitor hashes in the period (human redirects) |
| Bot requests | Bot classification events in the period |
| Remaining visits | `maximumVisits - successfulVisitCount` when a limit exists |

Event **outcomes** include: `redirect_success`, `bot_request`, `password_failed`, `scheduled_block`, `disabled_block`, `expired_block`, `expired_redirect`, `limit_reached`.

Older click rows have a null outcome. They are legacy data. The old redirect path wrote a row only after a successful redirect, so Masir counts a legacy row as a click. It does not claim the row was human, a bot, or unique. The UI shows a note when the selected period includes legacy rows. The boundary date comes from the first classified row, not from a fixed date.

## Campaigns and UTM

A campaign groups links that belong together. The campaign holds values every link shares. Each link holds values that change per channel.

| Field | Set on | Purpose |
|-------|--------|---------|
| `utm_campaign` | Campaign (or link when no campaign) | Identifies the campaign |
| `utm_medium` | Campaign | Shared channel type, such as `email` |
| `utm_source` | Link | Channel, such as `newsletter` |
| `utm_term` | Link | Paid keyword or term |
| `utm_content` | Link | Tells two placements apart |

The redirect merges UTM values into the destination URL at redirect time. Precedence runs from low to high:

1. Query parameters already in the destination URL.
2. The link and campaign UTM values (campaign `utm_campaign` and `utm_medium` win when a campaign is set).
3. The query the visitor adds to the short link.

Campaign metrics group clicks by the link's current `utm_source`. Delete a campaign and its links stay. They lose campaign-level `utm_campaign` and `utm_medium`.

## Privacy

- No raw IP addresses in the database.
- Visitor identity uses a rotating daily hash.
- Country uses a proxy header when present.
- Link password hashes use the same helper as user login passwords.
- Sign-in credentials live in `auth_identities`, never on the user row.
- A deactivated member keeps their account; the flag sits on the membership, so their other workspaces are untouched.

## Backup

Dump the Postgres database named in `NUXT_DATABASE_URL`:

```sh
pg_dump "$NUXT_DATABASE_URL" > masir.sql
```

Losing the database loses all links and analytics.

## Docker

Production. `compose.yaml` builds the image and starts it with Postgres.

```sh
cp .env.example .env    # set POSTGRES_PASSWORD and NUXT_SESSION_PASSWORD
docker compose up -d --build
docker compose exec app bun run db:seed:admin
```

Postgres is not published to the host; the app reaches it over the compose network. Data lives on the `masir_db-data` volume and uploads on `masir_uploads`. The app waits for the database health check, then migrates on boot.

Development. `compose.dev.yaml` adds Mailpit and runs the app with hot reload, so an edit on the host reloads the page.

```sh
docker compose -f compose.dev.yaml up
docker compose -f compose.dev.yaml exec app bun run db:seed:admin
```

Read the caught mail at `http://localhost:8025`. Set `MASIR_APP_PORT`, `MASIR_DB_PORT`, `MASIR_MAIL_SMTP_PORT`, or `MASIR_MAIL_UI_PORT` in `.env` to publish a different host port. VS Code opens the same stack with **Reopen in Container**.

## Tests

The e2e tests build the app once into `.output`, then each test file starts a bun server from that build against its own database. This is the same artifact and runtime that Docker runs.

```sh
bun run test
```

`bun run test` starts the db service first and waits for it. It skips that step under `CI` and on a machine without Docker, where Postgres comes from somewhere else. The db service makes `masir_test` beside the application database on its first start. `TEST_DATABASE_URL` in `.env` points at it, and the tests create `masir_test_<file>` from it and keep them between runs. Drop these databases by hand if you rewrite an existing migration file. On a volume made before `masir_test` existed, the same step creates it.

```sh
bun run test:coverage
```

`bun run test:coverage` writes a coverage report to `coverage/`. The e2e server runs in its own process, so the report only holds code the test process imports: `shared/`, `server/utils/` and `app/composables/`. Route, repo and page modules read low for that reason, and only `shared/` has a threshold. CI runs this command.

Browser tests drive the built app in Chromium through Playwright, once per deployment shape: single workspace, multi-workspace, and cloud.

```sh
bun run test:browser        # builds, then runs
bun run test:browser:run    # reuses the last build
```

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun run db:migrate` | Apply migrations |
| `bun run db:seed:admin` | First admin user |
| `bun run test` | Tests (starts the db service first) |
| `bun run test:coverage` | Tests with a coverage report in `coverage/` |
| `bun run test:browser` | Browser tests, one project per deployment shape |
