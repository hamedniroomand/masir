# Self-hosting

The default shape. One workspace, your own domain, no subdomain machinery.

## What you need

Postgres 18 or newer, and somewhere to run a container. Masir is a single
Nitro process; it holds no state of its own beyond an in-memory cache.

## Configuration

Four values matter. Everything else has a working default.

```sh [.env]
# 32+ characters. openssl rand -base64 32
NUXT_SESSION_PASSWORD=

# Where people reach you, with protocol
NUXT_ROOT_DOMAIN=https://go.example.com
NUXT_PUBLIC_SHORT_DOMAIN=https://go.example.com

NUXT_DATABASE_URL=postgres://user:pass@host:5432/masir
```

Leave `NUXT_MULTI_WORKSPACE` at `false`. In this mode the server ignores the
request hostname entirely and serves its single workspace on whatever host the
request arrived on.

<ReadMore to="/reference/environment" title="Every environment variable" />

## Error reporting

Leave the Sentry variables empty and reporting stays off. Set
`NUXT_PUBLIC_SENTRY_DSN` to a DSN from sentry.io or from your own Sentry to
send errors and traces.

```sh [.env]
NUXT_PUBLIC_SENTRY_DSN=
NUXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

## Behind a proxy

Masir reads the client IP from `x-forwarded-for` for rate limiting, and the
visitor's country from a header your proxy sets.

```sh [.env]
NUXT_GEO_COUNTRY_HEADER=cf-ipcountry
```

Cloudflare sets `cf-ipcountry` and Vercel sets `x-vercel-ip-country`; both are
recognised without configuration. Without a proxy that adds one of these, the
country breakdown stays empty — Masir does no IP geolocation itself, because
that would mean handling IP addresses it has decided not to store.

## Registration

Public registration is **off** by default here, and should stay off.

If you turn it on, anybody can create an account — and then reach nothing. They
cannot join your workspace without an invitation, and they cannot create a
second one because self-hosted mode holds exactly one. They land on an empty
state with no way forward.

Invite people instead. It is the path that works.

## Running more than one instance

Two parts of Masir keep state in the process:

**The link cache** holds resolved links for 60 seconds. Running several
instances means each keeps its own, so an edit can take up to a minute to show
everywhere. That is usually acceptable.

**The rate limiter** counts in memory until you point it at Redis. With three
instances behind a load balancer, your sign-in limit is three times looser than
you configured.

```sh [.env]
NUXT_REDIS_URL=rediss://user:pass@host.upstash.io:6379
```

Set the proxy depth as well, or every caller shares one bucket:

```sh [.env]
NUXT_TRUSTED_PROXY_DEPTH=1
```

Also lower the connection pool if you scale out:

```sh [.env]
NUXT_DATABASE_POOL_MAX=10
```

Each instance opens up to this many connections. Postgres defaults to 100 total.

## Backups

One database holds everything:

```sh
pg_dump "$NUXT_DATABASE_URL" > masir.sql
```

Losing it loses the links and the analytics. Uploaded logos live wherever
`NUXT_STORAGE_*` points — local disk by default, which means they are not in the
dump. Mount `./data/uploads` as a volume, or set a bucket.

## Upgrading

```sh
git pull
docker compose up -d --build
```

Migrations run on boot under an advisory lock, so a rolling deploy applies them
once and the other instances wait. They are incremental and additive, so your
data comes along.

<ReadMore to="/guide/upgrading" title="Back up, skip versions, and recover" />
