# Linkyard

Self-hosted link manager for one team. Create short links, change destinations without changing the URL, and view click analytics.

## Quick start

```sh
git clone <repo>
cd linkyard
cp .env.example .env
# Edit .env — set NUXT_SESSION_PASSWORD (32+ chars) and NUXT_PUBLIC_SHORT_DOMAIN
bun install
bun run db:migrate
bun run db:seed:admin
bun run dev
```

Sign in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Environment

See `.env.example` for every variable. Boot fails with the variable name if a required value is missing or invalid.

## Architecture

- **Redirect path:** Nitro middleware resolves `/:slug` before the Vue app loads. One cached DB read, then `302` to the destination.
- **302 not 301:** Destinations stay editable; permanent redirects would be cached by browsers.
- **Cache:** In-memory slug cache (60s TTL), invalidated on edit/delete. Single-node only; use a shared store for multiple nodes.
- **Query passthrough:** The redirect keeps the query a visitor adds to the short link and sends it to the destination.
- **Analytics:** Events are recorded after the redirect decision via `waitUntil`. Read-time aggregation runs in SQLite.
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
5. **Delete** — slug moves to `reserved_slugs` so it cannot be reused immediately.

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

Linkyard estimates unique visitors with a daily hash:

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

Older click rows have a null outcome. They are legacy data. The old redirect path wrote a row only after a successful redirect, so Linkyard counts a legacy row as a click. It does not claim the row was human, a bot, or unique. The UI shows a note when the selected period includes legacy rows. The boundary date comes from the first classified row, not from a fixed date.

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
- Password hashes use the same helper as user login passwords.

## Backup

Copy the SQLite file (`NUXT_DATABASE_URL`, default `./data/linkyard.db`). Losing the file loses all links and analytics.

## Docker

```sh
cp .env.example .env
docker compose up --build
docker compose exec app bun run db:seed:admin
```

Database file lives on the `linkyard-data` volume at `/data/linkyard.db`.

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun run db:migrate` | Apply migrations |
| `bun run db:seed:admin` | First admin user |
| `bun run test` | Tests |
