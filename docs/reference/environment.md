# Environment variables

Masir validates these at boot and refuses to start on a bad one, naming the
variable in the first line of the log.

## Required

| Variable | Notes |
|---|---|
| `NUXT_SESSION_PASSWORD` | 32 characters or more. `openssl rand -base64 32` |
| `NUXT_DATABASE_URL` | `postgres://user:pass@host:5432/masir` |
| `NUXT_ROOT_DOMAIN` | Origin of the root site, with protocol |
| `NUXT_PUBLIC_SHORT_DOMAIN` | Origin printed with short links, no trailing slash |

Changing `NUXT_SESSION_PASSWORD` invalidates every session. That is the fastest
way to sign everybody out.

## Database

| Variable | Default | Notes |
|---|---|---|
| `NUXT_DATABASE_URL` | `postgres://masir:masir@127.0.0.1:5432/masir` | |
| `NUXT_DATABASE_POOL_MAX` | `10` | Connections per instance |
| `NUXT_MIGRATE_ON_BOOT` | `true` | Apply migrations when the server starts |

Migrations take a Postgres advisory lock, so a rolling deploy or `--scale app=3`
applies them exactly once and the other instances wait. On serverless, set
`NUXT_MIGRATE_ON_BOOT=false` — every cold start would otherwise run them — and
migrate as a deploy step against the direct connection string.

Multiply the pool by your instance count and keep it under the Postgres
`max_connections`, which defaults to 100. On serverless, set it to `1` and use a
pooled connection string.

## Deployment

| Variable | Default | Notes |
|---|---|---|
| `NUXT_DEPLOYMENT_MODE` | `SELF_HOSTED` | Or `CLOUD` |
| `NUXT_MULTI_WORKSPACE` | `false` | Subdomain per workspace |
| `NUXT_SESSION_COOKIE_DOMAIN` | — | **Required** when multi-workspace is true |
| `NUXT_ALLOW_REGISTRATION` | `false` | Public sign-up |
| `NUXT_TRIAL_DAYS` | `7` | Cloud mode only |

`NUXT_SESSION_COOKIE_DOMAIN` needs the leading dot: `.example.com`. Without it
the session does not cross subdomains and switching workspaces asks people to
sign in again.

## Mail

Providers register themselves by name, and the driver is chosen once per
process.

| Variable | Default | Notes |
|---|---|---|
| `NUXT_MAIL_DRIVER` | — | `smtp`, `resend`, `outbox`, or `log` |
| `NUXT_MAIL_FROM` | `Masir <no-reply@localhost>` | |
| `NUXT_MAIL_SMTP_HOST` | — | Enables the SMTP provider |
| `NUXT_MAIL_SMTP_PORT` | `587` | |
| `NUXT_MAIL_SMTP_USER` | — | Omit for an unauthenticated relay |
| `NUXT_MAIL_SMTP_PASSWORD` | — | |
| `NUXT_MAIL_SMTP_SECURE` | `false` | `true` for implicit TLS on 465 |
| `NUXT_MAIL_SMTP_POOL_MAX` | `5` | Open SMTP connections |
| `NUXT_MAIL_API_KEY` | — | Enables the Resend provider |

Leave `NUXT_MAIL_DRIVER` empty and the first configured provider wins: SMTP if a
host is set, then Resend if an API key is set, then the log driver. A deployment
with no mail configuration still boots — messages go to the application log,
including the links inside them.

Name a driver explicitly to pin it. An unknown or unconfigured name logs a
warning and falls back to the log driver rather than failing a request.

## Storage

Workspace logos. Local disk by default.

| Variable | Default | Notes |
|---|---|---|
| `NUXT_STORAGE_DRIVER` | — | `s3` or `file` |
| `NUXT_STORAGE_BUCKET` | — | Enables the S3 provider |
| `NUXT_STORAGE_ACCESS_KEY_ID` | — | |
| `NUXT_STORAGE_SECRET_ACCESS_KEY` | — | |
| `NUXT_STORAGE_ENDPOINT` | — | Set for R2 or another S3-compatible host |
| `NUXT_STORAGE_LOCAL_ROOT` | `./data/uploads` | Enables the file provider |
| `NUXT_STORAGE_PUBLIC_BASE_URL` | `http://localhost:3000/uploads` | |

Leave `NUXT_STORAGE_DRIVER` empty and a bucket wins; otherwise the file provider
takes it, because it always holds a root.

S3 and R2 use the same four values; R2 needs its endpoint. Uploads go through
Bun's built-in S3 client, so neither adds a dependency.

::: warning The file provider needs a real disk
It writes to the local filesystem, which works on a VPS or a container with a
mounted volume and does not survive an edge or serverless cold start. With
`NUXT_DEPLOYMENT_MODE=CLOUD` and no bucket, the app refuses to boot rather than
lose every upload later.
:::

## OAuth

| Variable | Default |
|---|---|
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` | — |
| `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | — |
| `NUXT_OAUTH_MICROSOFT_CLIENT_ID` | — |
| `NUXT_OAUTH_MICROSOFT_CLIENT_SECRET` | — |
| `NUXT_OAUTH_MICROSOFT_TENANT` | `common` |

Leave a client ID empty and that provider's button is hidden. The interface asks
`GET /api/auth/providers` at runtime, so turning a provider on needs a restart,
not a rebuild.

Set `NUXT_OAUTH_MICROSOFT_TENANT` to your tenant ID to accept one organisation
only.

## Requests

| Variable | Default | Notes |
|---|---|---|
| `NUXT_ALLOW_PRIVATE_DESTINATIONS` | `false` | Allow private-network destinations |
| `NUXT_GEO_COUNTRY_HEADER` | — | Country header your proxy sets |
| `NUXT_TRUSTED_PROXY_DEPTH` | `0` | Proxies in front of the app |
| `NUXT_VISITOR_HASH_SECRET` | — | Falls back to the session password |

::: warning Set the proxy depth to match your deployment
At `0` the client address comes from the socket and `X-Forwarded-For` is
ignored. Behind one nginx or one CDN, set `1`.

Getting this wrong in either direction costs you. Too low behind a proxy puts
every caller in one bucket, so one noisy client rate-limits everybody. Too high
lets a caller write their own address and reset every limit, which is the same
as having none.
:::

Keep `NUXT_ALLOW_PRIVATE_DESTINATIONS` off in production. A shortener that
accepts `http://169.254.169.254/` is a request-forgery tool pointed at your own
metadata service.

## Rate limits

Counted in memory, per instance.

| Variable | Default |
|---|---|
| `NUXT_REDIS_URL` | — |
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

::: warning What happens when the store is unreachable
Authentication routes **refuse**, so an outage cannot quietly turn off
brute-force protection. The redirect path keeps serving, because a shortener
that stops redirecting when Redis blinks is the worse failure.
:::

## Seed script

Read by `bun run db:seed:admin` only, never by the server.

| Variable | Default |
|---|---|
| `ADMIN_EMAIL` | `admin@example.com` |
| `ADMIN_PASSWORD` | — |

## Compose

Read by Docker Compose from `.env`, never by the server.

| Variable | Default | Stack |
|---|---|---|
| `POSTGRES_PASSWORD` | — | production, **required** |
| `MASIR_APP_PORT` | `3000` | both |
| `MASIR_DB_PORT` | `5432` | development |
| `MASIR_MAIL_SMTP_PORT` | `1025` | development |
| `MASIR_MAIL_UI_PORT` | `8025` | development |

`POSTGRES_PASSWORD` goes into a connection string unescaped, so use letters
and digits only: `openssl rand -hex 24`. Changing it after the first start does
not change the password inside the existing volume.

The port variables set the host port of a published service. The port inside
the container never changes. The production stack publishes only the app; the
development stack publishes Postgres and Mailpit on `127.0.0.1` as well.

Change `NUXT_ROOT_DOMAIN` and `NUXT_PUBLIC_SHORT_DOMAIN` as well when you move
the app port.
