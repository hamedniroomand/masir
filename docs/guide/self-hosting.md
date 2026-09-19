# Self-hosting

This page covers what you need to know once Masir is installed and serving real
traffic: proxies, email, scaling, backups, and error reporting. The
[installation guide](/guide/installation) gets you to a running instance first.

## What you are running

Masir is one process and one Postgres database. The process holds nothing
durable. Its only in-memory state is a short link cache and, unless you point
it at Redis, the rate-limit counters. You can stop it, move it, or run more of
it without losing anything.

## The four values that matter

Everything else has a working default.

```sh [.env]
# 32 characters or more. openssl rand -base64 32
NUXT_SESSION_PASSWORD=

# Where people reach the app, with protocol
NUXT_ROOT_DOMAIN=https://go.example.com

# The origin printed in front of every slug, no trailing slash
NUXT_PUBLIC_SHORT_DOMAIN=https://go.example.com

NUXT_DATABASE_URL=postgres://user:pass@host:5432/masir
```

Leave `NUXT_MULTI_WORKSPACE` at `false` unless you want a subdomain per
workspace. In single-workspace mode the server ignores the hostname and serves
its one workspace on whatever host the request arrived on.

<ReadMore to="/reference/environment" title="Every environment variable" />

## A landing page on the root

By default `example.com/` is the app. To put a public landing page there and
run the app on its own host, set one more value:

```sh [.env]
NUXT_APP_DOMAIN=https://app.example.com
```

Then:

- `example.com/` renders a landing page that crawlers may index. It links to
  sign-in and, when registration is open, to sign-up on the app host.
- `example.com/{slug}` keeps serving short links, with the link path in front
  when the workspace has one. The unlock page for a protected link stays here
  too.
- Every other app path on the root, such as `/login` or `/dashboard`, answers
  a redirect to the same path on `app.example.com`.
- Emails for verification and password reset link to the app host.

Point both names at the same instance. In multi-workspace mode the app host
must be the root or a subdomain of it, because the session cookie is scoped to
the root. Leave the value empty to get the old behaviour back.

## Behind a reverse proxy

Most instances sit behind nginx, Caddy, Traefik, or a CDN that terminates TLS.
Two settings depend on that.

**Tell Masir how many proxies are in front of it.** At `0`, the client address
comes from the socket and `X-Forwarded-For` is ignored. Behind one proxy, set
`1`.

```sh [.env]
NUXT_TRUSTED_PROXY_DEPTH=1
```

Getting this wrong costs you either way. Too low and every visitor shares one
rate-limit bucket, so one noisy client blocks everyone. Too high and a caller
can write their own address into the header and reset every limit.

**Pass a country header if you want the country breakdown.** Masir never
geolocates an IP itself, because that would mean handling the address it has
decided not to store. It reads a header your proxy sets instead. Cloudflare's
`cf-ipcountry` and Vercel's `x-vercel-ip-country` are recognised out of the
box. For anything else, name the header:

```sh [.env]
NUXT_GEO_COUNTRY_HEADER=x-geo-country
```

Without a proxy that adds one, the country breakdown stays empty.

## Plain HTTP on a private network

The session cookie is marked `Secure`, and browsers refuse to send a `Secure`
cookie over plain HTTP to any host except `localhost`. An instance reached as
`http://intranet.example` will sign nobody in until you set:

```sh [.env]
NUXT_SESSION_COOKIE_SECURE=false
```

Put TLS in front instead whenever you can.

## Email

Invitations and password recovery need a mail provider. Without one, messages
go to the application log. See [Sending email](/guide/authentication#sending-email)
for SMTP and Resend.

## Running more than one instance

Two parts of Masir keep state in the process.

**The link cache** holds resolved links for 60 seconds. With several instances
each keeps its own, so an edit can take up to a minute to show everywhere.
That is usually fine for a shortener.

**The rate limiter** counts in memory until you point it at Redis. With three
instances behind a load balancer, each limit is three times looser than you
configured. Set a shared store before you scale out:

```sh [.env]
NUXT_REDIS_URL=rediss://user:pass@host.upstash.io:6379
```

Use the TLS endpoint, not the REST URL. If the store becomes unreachable, sign-in
and other protected routes refuse until it is back, so an outage cannot quietly
turn off brute-force protection. The redirect path keeps serving.

Also watch the connection pool. Each instance opens up to
`NUXT_DATABASE_POOL_MAX` connections, 10 by default, and Postgres allows 100 in
total by default. Multiply the pool by your instance count and keep the result
under that.

## Uploaded logos

Workspace logos go to local disk by default, under `./data/uploads`. The Compose
stack mounts a volume there so they survive a recreate. If your instance runs
on a platform without a disk that lasts between requests, use an S3-compatible
bucket instead:

```sh [.env]
NUXT_STORAGE_BUCKET=masir
NUXT_STORAGE_ACCESS_KEY_ID=...
NUXT_STORAGE_SECRET_ACCESS_KEY=...
NUXT_STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com
NUXT_STORAGE_PUBLIC_BASE_URL=https://cdn.example.com
```

The database stores the storage key, not the URL, so you can move files to a
new bucket or host later. Copy the objects and change the public base URL.

## Error reporting

Leave the Sentry variables empty and nothing is sent anywhere. Set a DSN from
sentry.io or from your own Sentry to report errors:

```sh [.env]
NUXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NUXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

Tracing is off by default. Set `NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` to a
fraction between 0 and 1 to turn it on. Turning Sentry on for the first time
needs a rebuild, because the module is only compiled in when at least one of
its variables is set.

## Backups

One database holds everything. Back it up before every upgrade and on a
schedule that matches how much you would mind losing.

```sh
pg_dump "$NUXT_DATABASE_URL" > masir-$(date +%F).sql
```

Uploaded logos are not in the dump. They live wherever `NUXT_STORAGE_*` points.
Back up the `masir_uploads` volume, or use a bucket.

## Upgrading

```sh
git pull
docker compose up -d --build
```

Migrations run on boot under an advisory lock. A rolling deploy applies them
once while the other instances wait. They only add to the schema, so the
instances still running the old version keep working until they restart.

<ReadMore to="/guide/upgrading" title="Back up, pin versions, and recover" />
