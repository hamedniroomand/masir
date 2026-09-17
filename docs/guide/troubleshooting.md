# Troubleshooting

## The app exits on start

Read the first line of the log. Masir validates its configuration at boot and
names the variable it is unhappy about:

```text
Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)
Missing or invalid NUXT_DATABASE_URL (must be a postgres:// connection string)
NUXT_MULTI_WORKSPACE is true, so NUXT_SESSION_COOKIE_DOMAIN must be set
```

This is intentional. A missing value that fails later, under load, in a way that
looks like something else, costs far more than a refused boot.

## `/api/health` returns 503

The app is running and Postgres is not reachable. Check `NUXT_DATABASE_URL`,
then check that the database accepts connections from the app's network.

```sh
docker compose exec app bun -e "console.log(process.env.NUXT_DATABASE_URL)"
```

## Migration fails with "contains null values"

You are applying a migration that adds a `NOT NULL` column to a table that
already has rows, on a database from before the workspace model.

Masir was not published when that change landed, so there is no backfill. If
the data is disposable, recreate the database:

```sh
docker compose exec db psql -U postgres -c 'drop database masir with (force)'
docker compose exec db psql -U postgres -c 'create database masir'
docker compose exec app bun run db:migrate
docker compose exec app bun run db:seed:admin
```

## Sign-in works, then every page says not found

The account has no workspace membership. This happens when public registration
is on in self-hosted mode: the person can register, but cannot join your
workspace without an invitation and cannot create a second one.

Invite them from **Settings → Members**, or turn registration off:

```sh [.env]
NUXT_ALLOW_REGISTRATION=false
```

## Switching workspaces asks me to sign in again

`NUXT_SESSION_COOKIE_DOMAIN` is wrong. It needs the parent domain with a leading
dot:

```sh [.env]
NUXT_SESSION_COOKIE_DOMAIN=.example.com
```

## OAuth returns redirect_uri_mismatch

The URI registered with the provider must match what Masir sends, byte for
byte — protocol, host, port, path, no trailing slash.

The most common cause is `127.0.0.1` against a registration for `localhost`.
Providers treat those as different origins.

## Country is always empty

Masir reads the country from a proxy header and never geolocates an IP
itself. Without a proxy in front that sets one, there is no country data.

```sh [.env]
NUXT_GEO_COUNTRY_HEADER=cf-ipcountry
```

## "sorry, too many clients already"

Each instance opens up to `NUXT_DATABASE_POOL_MAX` connections, and Postgres
allows 100 in total by default. Multiply your instance count by the pool size;
if it approaches 100, lower the pool.

```sh [.env]
NUXT_DATABASE_POOL_MAX=10
```

On serverless, set it to `1` and use a pooled connection string.

## Invitation emails never arrive

With no `NUXT_MAIL_API_KEY`, messages are written to the log instead of sent.
Check the app log — the message is there, including the link. Configure a
provider for real delivery.

## A link 404s that should work

Three things produce a `404` on a link that exists:

The link is **disabled**, **expired**, or has hit its **visit cap**. Open it in
the dashboard; the status badge says which.

Or you are on the wrong host. In multi-workspace mode a link only resolves on
its own workspace's subdomain.
