# Environment variables

Masir validates these at boot and refuses to start on a bad one, naming the
variable in the first line of the log. Every variable has a default except the
ones under **Required**.

`.env.example` in the repository lists every variable with a comment. Copy it
and edit.

## Required

| Variable | Notes |
|---|---|
| `NUXT_SESSION_PASSWORD` | 32 characters or more. `openssl rand -base64 32` |
| `NUXT_DATABASE_URL` | `postgres://user:pass@host:5432/masir`. Postgres 18 or newer. The Compose stacks build this one themselves |
| `NUXT_ROOT_DOMAIN` | Origin of the root site, with protocol and port |
| `NUXT_PUBLIC_SHORT_DOMAIN` | Origin printed in front of every slug, no trailing slash |

Changing `NUXT_SESSION_PASSWORD` signs everyone out at once.

## Database

| Variable | Default | Notes |
|---|---|---|
| `NUXT_DATABASE_URL` | `postgres://masir:masir@127.0.0.1:5432/masir` | |
| `NUXT_DATABASE_POOL_MAX` | `10` | Connections per instance |
| `NUXT_MIGRATE_ON_BOOT` | `true` | Apply migrations when the server starts |

Migrations take a Postgres advisory lock, so a rolling deploy applies them
exactly once. On serverless, set `NUXT_MIGRATE_ON_BOOT=false`, because every
cold start would otherwise run them, and migrate as a deploy step against the
direct connection string.

Multiply the pool by your instance count and keep it under the Postgres
`max_connections`, which defaults to 100. On serverless, set it to `1` or `2`
and use a pooled connection string.

## Deployment

| Variable | Default | Notes |
|---|---|---|
| `NUXT_DEPLOYMENT_MODE` | `SELF_HOSTED` | Or `CLOUD` |
| `NUXT_MULTI_WORKSPACE` | `false` | A subdomain per workspace |
| `NUXT_SESSION_COOKIE_DOMAIN` | | **Required** when multi-workspace is on. Leading dot: `.example.com` |
| `NUXT_SESSION_COOKIE_SECURE` | `true` | `false` only for plain HTTP on a private network |
| `NUXT_ALLOW_REGISTRATION` | `false` | Public sign-up |
| `NUXT_SERVERLESS` | from the build | `true` on the `vercel` preset. Set it yourself on a container that keeps no disk |

Without the leading dot on the cookie domain, the session does not cross
subdomains and switching workspaces asks people to sign in again.

A `Secure` cookie never travels over plain HTTP, except to `localhost`. An
instance reached as `http://intranet.example` signs nobody in until
`NUXT_SESSION_COOKIE_SECURE=false`. Put TLS in front instead when you can.

## Mail

| Variable | Default | Notes |
|---|---|---|
| `NUXT_MAIL_DRIVER` | | `smtp`, `resend`, `outbox`, or `log` |
| `NUXT_MAIL_FROM` | `Masir <no-reply@localhost>` | |
| `NUXT_MAIL_SMTP_HOST` | | Enables the SMTP provider |
| `NUXT_MAIL_SMTP_PORT` | `587` | |
| `NUXT_MAIL_SMTP_USER` | | Omit for an unauthenticated relay |
| `NUXT_MAIL_SMTP_PASSWORD` | | |
| `NUXT_MAIL_SMTP_SECURE` | `false` | `true` for implicit TLS on 465 |
| `NUXT_MAIL_SMTP_POOL_MAX` | `5` | Open SMTP connections |
| `NUXT_MAIL_API_KEY` | | Enables the Resend provider |

Leave `NUXT_MAIL_DRIVER` empty and the first configured provider wins: SMTP if
a host is set, then Resend if a key is set, then the log driver. An instance
with no mail configuration still boots. Messages go to the application log,
including the links inside them.

Name a driver to pin it. An unknown or unconfigured name logs a warning and
falls back to the log driver rather than failing a request. The `outbox`
driver holds messages in memory and exists for tests.

## Storage

Workspace logos. Local disk by default.

| Variable | Default | Notes |
|---|---|---|
| `NUXT_STORAGE_DRIVER` | | `s3` or `file` |
| `NUXT_STORAGE_BUCKET` | | Enables the S3 provider |
| `NUXT_STORAGE_ACCESS_KEY_ID` | | |
| `NUXT_STORAGE_SECRET_ACCESS_KEY` | | |
| `NUXT_STORAGE_ENDPOINT` | | Set for R2 or another S3-compatible host |
| `NUXT_STORAGE_LOCAL_ROOT` | `./data/uploads` | Root of the file provider |
| `NUXT_STORAGE_PUBLIC_BASE_URL` | `http://localhost:3000/uploads` | Public prefix for reading uploads |
| `NUXT_STORAGE_MAX_UPLOAD_BYTES` | `2097152` | Largest logo accepted, 2 MiB |

Leave `NUXT_STORAGE_DRIVER` empty and a bucket wins. Otherwise the file
provider is used, because it always has a root.

The database stores the storage key of a logo, not its URL. You can change the
public base URL or move the files to another bucket without a data migration.

S3 and R2 use the same four values; R2 needs its endpoint. Uploads go through
Bun's built-in S3 client.

::: warning The file provider needs a real disk
It writes to the local filesystem, which works on a VPS or a container with a
mounted volume and does not survive a serverless cold start. When
`NUXT_SERVERLESS` is true and no bucket is set, the app refuses to boot rather
than lose every upload later.
:::

## OAuth

| Variable | Default |
|---|---|
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` | |
| `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | |
| `NUXT_OAUTH_MICROSOFT_CLIENT_ID` | |
| `NUXT_OAUTH_MICROSOFT_CLIENT_SECRET` | |
| `NUXT_OAUTH_MICROSOFT_TENANT` | `common` |

Leave a client id empty and that provider's button is hidden. The interface
asks the server which providers exist at runtime, so turning one on needs a
restart, not a rebuild.

Set `NUXT_OAUTH_MICROSOFT_TENANT` to your tenant id to accept one organisation
only.

## Bot protection

| Variable | Default |
|---|---|
| `NUXT_PUBLIC_TURNSTILE_SITE_KEY` | |
| `NUXT_TURNSTILE_SECRET_KEY` | |

Set both and the email sign-in and sign-up forms show a Cloudflare Turnstile
check. Leave both empty and the forms work without it. The OAuth buttons never
show the check.

Create the keys in the Cloudflare dashboard under Turnstile, add a widget, and
list every hostname that serves the login page. With multi-workspace on, that
is the root domain. The site key is public and goes into the browser. Keep the
secret key on the server.

Turning the check on or off needs a restart. An unreachable Cloudflare counts
as a failed check.

## Product analytics

| Variable | Default | Notes |
|---|---|---|
| `NUXT_PUBLIC_SCRIPTS_GOOGLE_ANALYTICS_ID` | | GA4 measurement id, `G-XXXXXXXX` |

Set it to record page views of the application itself. The tag loads after the
interface is ready and stays off the short-link visitor pages. Leave it empty
and the script is never requested. The id is public and reaches the browser.

## Error reporting

Sentry stays off until at least one of these is set.

| Variable | Default | Notes |
|---|---|---|
| `NUXT_PUBLIC_SENTRY_DSN` | | Project DSN. The browser reads this one |
| `NUXT_PUBLIC_SENTRY_ENVIRONMENT` | | `production`, `staging`, or your own label |
| `NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0` | Fraction of requests to trace, 0 to 1. `0` sends errors only |
| `NUXT_PUBLIC_SENTRY_RELEASE` | | Release name. Empty lets the SDK pick |
| `SENTRY_AUTH_TOKEN` | | Build only. Uploads source maps |
| `SENTRY_ORG` | | Build only. Organisation slug |
| `SENTRY_PROJECT` | | Build only. Project slug |
| `SENTRY_URL` | | Build only. Set for a self-hosted Sentry |

A DSN from sentry.io or from your own Sentry both work. Setting these for the
first time needs a rebuild, because the module is compiled in only when at
least one of them is present at build.

The three `SENTRY_*` build variables are read when `nuxt build` runs. Set them
in that environment if you want readable client stack traces. The Docker build
takes the token as a build secret named `sentry_auth_token`, never as a build
argument, so it stays out of the image layers. Compose fills it from
`SENTRY_AUTH_TOKEN` in your shell or `.env`.

## Alerts

| Variable | Default | Notes |
|---|---|---|
| `NUXT_ALERTS_INTERVAL_MINUTES` | `15` | How often the instance sweeps for links that expire soon. `0` turns the sweep off, `35000` is the most |
| `NUXT_JOBS_SECRET` | | Bearer token for `POST /api/jobs/alerts`. Empty makes the route answer `404` |

A long-running instance runs the sweep itself on the interval. A serverless
deployment stops between requests, so it leaves the interval at `0`, sets
`NUXT_JOBS_SECRET`, and points an external cron at the jobs route. See
[Vercel](/guide/vercel#cron).

## Requests

| Variable | Default | Notes |
|---|---|---|
| `NUXT_ALLOW_PRIVATE_DESTINATIONS` | `false` | Allow private-network destinations |
| `NUXT_GEO_COUNTRY_HEADER` | | Country header your proxy sets |
| `NUXT_TRUSTED_PROXY_DEPTH` | `0` | Proxies in front of the app |
| `NUXT_VISITOR_HASH_SECRET` | | Salt for the visitor hash. Falls back to the session password |

::: warning Set the proxy depth to match your deployment
At `0` the client address comes from the socket and `X-Forwarded-For` is
ignored. Behind one nginx or one CDN, set `1`.

Too low behind a proxy puts every caller in one bucket, so one noisy client
rate-limits everybody. Too high lets a caller write their own address and reset
every limit, which is the same as having none.
:::

Keep `NUXT_ALLOW_PRIVATE_DESTINATIONS` off in production. A shortener that
accepts `http://169.254.169.254/` is a request-forgery tool pointed at your own
metadata service.

Set `NUXT_VISITOR_HASH_SECRET` so that rotating the session password does not
reset the day's unique visitor counts.

## Rate limits

| Variable | Default |
|---|---|
| `NUXT_REDIS_URL` | |
| `NUXT_RATE_LIMIT_LOGIN_PER_MINUTE` | `10` |
| `NUXT_RATE_LIMIT_WORKSPACE_PER_DAY` | `5` |
| `NUXT_RATE_LIMIT_REDIRECT_PER_MINUTE` | `120` |
| `NUXT_RATE_LIMIT_CREATE_PER_HOUR` | `30` |
| `NUXT_RATE_LIMIT_UPDATE_PER_MINUTE` | `60` |
| `NUXT_RATE_LIMIT_PASSWORD_PER_MINUTE` | `10` |
| `NUXT_RATE_LIMIT_SLUG_CHECK_PER_MINUTE` | `30` |
| `NUXT_RATE_LIMIT_INVITE_PER_HOUR` | `30` |

Counters live in the process unless `NUXT_REDIS_URL` is set. Three instances
then means each limit is three times looser than configured, so set it before
you run more than one.

Use the **TLS** endpoint (`rediss://…upstash.io:6379`), not the REST URL.

::: warning When the store is unreachable
Authentication and other protected routes **refuse**, so an outage cannot
quietly turn off brute-force protection. The redirect path keeps serving,
because a shortener that stops redirecting when Redis blinks is the worse
failure.
:::

## Seed script

Read by `bun run db:seed:admin` only, never by the server.

| Variable | Default |
|---|---|
| `ADMIN_EMAIL` | `admin@example.com` |
| `ADMIN_PASSWORD` | |

## Compose

Read by Docker Compose from `.env`, never by the server.

| Variable | Default | Stack |
|---|---|---|
| `POSTGRES_PASSWORD` | | production, **required** |
| `MASIR_APP_PORT` | `3000` | both |
| `MASIR_DB_PORT` | `5432` | development |
| `MASIR_MAIL_SMTP_PORT` | `1025` | development |
| `MASIR_MAIL_UI_PORT` | `8025` | development |

`POSTGRES_PASSWORD` goes into a connection string unescaped, so use letters and
digits only: `openssl rand -hex 24`. Changing it after the first start does not
change the password inside the existing volume.

The port variables set the host port of a published service. The port inside
the container never changes. The production stack publishes only the app. The
development stack also publishes Postgres and Mailpit on `127.0.0.1`.

Change `NUXT_ROOT_DOMAIN` and `NUXT_PUBLIC_SHORT_DOMAIN` too when you move the
app port.
