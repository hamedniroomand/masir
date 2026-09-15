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
- **Analytics:** Clicks recorded after the redirect via `waitUntil`. Read-time aggregation in SQLite.
- **Privacy:** No raw IP storage. Country comes from a proxy header (`GEO_COUNTRY_HEADER`, `cf-ipcountry`, or `x-vercel-ip-country`). Default Docker deploy has no country data unless you add a proxy.

## Campaigns and UTM

A campaign groups links that belong together. The campaign holds the values every link shares. Each link holds the values that change per channel.

| Field | Set on | Purpose |
|-------|--------|---------|
| `utm_campaign` | Campaign | Identifies the campaign. Required. |
| `utm_medium` | Campaign | The shared channel type, such as `email`. Optional. |
| `utm_source` | Link | The channel, such as `newsletter`. Optional. |
| `utm_content` | Link | Tells two placements apart. Optional. |

The redirect merges these values into the destination URL. Precedence runs from low to high:

1. Query parameters already in the destination URL.
2. The link and campaign UTM values.
3. The query the visitor adds to the short link.

So `go.example/launch?utm_source=twitter` overrides the `utm_source` stored on the link. One short link works for many channels.

Campaign metrics group clicks by the link's current `utm_source`. If you change a link's `utm_source`, past clicks move to the new value. Linkyard does not store the UTM values on each click row.

Delete a campaign and its links stay. They lose `utm_campaign` and `utm_medium`.

## Link lifecycle

1. **Create** — random or custom slug; slug is immutable.
2. **Redirect** — middleware lookup + optional click row.
3. **Edit** — destination, title, expiry, enabled flag, campaign, UTM values; slug unchanged.
4. **Disable / expire** — visitor sees a plain 404 state page.
5. **Delete** — slug moves to `reserved_slugs` so it cannot be reused immediately.

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
