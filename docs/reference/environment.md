# Environment variables

> Configure Masir at runtime. Restart the application after a value changes.

Copy `.env.example` and edit it. Masir validates critical values at boot and
stops with a named error when they are invalid.

## Required values

| Variable | Default | Rule |
|---|---|---|
| `NUXT_SESSION_PASSWORD` | none | At least 32 characters |
| `NUXT_DATABASE_URL` | local development URL | Postgres 18 connection |
| `NUXT_ROOT_DOMAIN` | `http://localhost:3000` | Full HTTP or HTTPS origin |
| `NUXT_PUBLIC_SHORT_DOMAIN` | `http://localhost:3000` | Origin printed in short links |

The production Compose files construct the database URL and require
`POSTGRES_PASSWORD`.

Changing the session password signs every user out. Set a separate visitor
hash secret so this does not also reset daily unique counts.

## Database and session

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_SESSION_PASSWORD` | none | Seals session cookies |
| `NUXT_VISITOR_HASH_SECRET` | session password | Salts daily visitor hashes |
| `NUXT_DATABASE_URL` | `postgres://masir:masir@127.0.0.1:5432/masir` | Runtime database |
| `NUXT_DATABASE_POOL_MAX` | `10` | Connections per app instance |
| `NUXT_MIGRATE_ON_BOOT` | `true` | Applies pending migrations at startup |
| `TEST_DATABASE_URL` | `postgres://masir:masir@127.0.0.1:5432/masir_test` | Test-only database source |

On serverless, set the pool to one or two, turn off boot migration, and run
`bun run db:migrate` during deployment.

## Deployment and domains

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_DEPLOYMENT_MODE` | `SELF_HOSTED` | `SELF_HOSTED` or `CLOUD` |
| `NUXT_ROOT_DOMAIN` | `http://localhost:3000` | Root host boundary |
| `NUXT_APP_DOMAIN` | empty | Optional sign-in and dashboard origin |
| `NUXT_PUBLIC_SHORT_DOMAIN` | `http://localhost:3000` | Displayed short-link origin |
| `NUXT_MULTI_WORKSPACE` | `false` | Enables workspace subdomains |
| `NUXT_SESSION_COOKIE_DOMAIN` | empty | Required parent domain in multi mode |
| `NUXT_SESSION_COOKIE_SECURE` | `true` | Sends the session only over HTTPS |
| `NUXT_ALLOW_REGISTRATION` | `false` | Enables public registration |
| `NUXT_SERVERLESS` | build target | Marks hosts without durable disk or process |
| `NUXT_DEMO_ENABLED` | `false` | Enables 24-hour seeded demo workspaces |

Multi-workspace mode needs a dotted root hostname and a cookie domain such as
`.example.com`. It does not support `localhost`, an IP address, or a bare
local hostname.

## Mail

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_MAIL_DRIVER` | automatic | `smtp`, `resend`, `outbox`, or `log` |
| `NUXT_MAIL_FROM` | `Masir <no-reply@localhost>` | Sender header |
| `NUXT_MAIL_SMTP_HOST` | empty | Enables SMTP |
| `NUXT_MAIL_SMTP_PORT` | `587` | SMTP port |
| `NUXT_MAIL_SMTP_USER` | empty | Optional SMTP user |
| `NUXT_MAIL_SMTP_PASSWORD` | empty | Optional SMTP password |
| `NUXT_MAIL_SMTP_SECURE` | `false` | Implicit TLS, usually on port 465 |
| `NUXT_MAIL_SMTP_POOL_MAX` | `5` | Open SMTP connections |
| `NUXT_MAIL_API_KEY` | empty | Enables Resend |

Automatic selection tries SMTP, then Resend, then the log driver. The outbox
driver is for tests.

## Storage

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_STORAGE_DRIVER` | automatic | `file` or `s3` |
| `NUXT_STORAGE_LOCAL_ROOT` | `./data/uploads` | File storage root |
| `NUXT_STORAGE_PUBLIC_BASE_URL` | `http://localhost:3000/uploads` | Public object prefix |
| `NUXT_STORAGE_ACCESS_KEY_ID` | empty | S3-compatible access key |
| `NUXT_STORAGE_SECRET_ACCESS_KEY` | empty | S3-compatible secret |
| `NUXT_STORAGE_BUCKET` | empty | Enables S3 selection |
| `NUXT_STORAGE_ENDPOINT` | empty | R2 or custom S3 endpoint |
| `NUXT_STORAGE_MAX_UPLOAD_BYTES` | `2097152` | Maximum workspace logo size |

Automatic selection prefers S3 when a bucket is set, then file storage.
Serverless mode rejects file storage.

## OAuth and bot checks

| Variable | Default |
|---|---|
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` | empty |
| `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | empty |
| `NUXT_OAUTH_MICROSOFT_CLIENT_ID` | empty |
| `NUXT_OAUTH_MICROSOFT_CLIENT_SECRET` | empty |
| `NUXT_OAUTH_MICROSOFT_TENANT` | `common` |
| `NUXT_PUBLIC_TURNSTILE_SITE_KEY` | empty |
| `NUXT_TURNSTILE_SECRET_KEY` | empty |

A provider button appears when its client ID is set. Cloud mode requires a
specific Microsoft tenant.

Turnstile runs only when both keys are set.

## Request handling

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_ALLOW_PRIVATE_DESTINATIONS` | `false` | Allows private-network link targets |
| `NUXT_GEO_COUNTRY_HEADER` | empty | Trusted country-code header |
| `NUXT_TRUSTED_PROXY_DEPTH` | `0` | Trusted proxies before the app |

Keep private destinations off on a public deployment. Set proxy depth to the
exact network chain.

## Rate limits

| Variable | Default |
|---|---|
| `NUXT_REDIS_URL` | empty |
| `NUXT_RATE_LIMIT_LOGIN_PER_MINUTE` | `10` |
| `NUXT_RATE_LIMIT_WORKSPACE_PER_DAY` | `5` |
| `NUXT_RATE_LIMIT_REDIRECT_PER_MINUTE` | `120` |
| `NUXT_RATE_LIMIT_CREATE_PER_HOUR` | `30` |
| `NUXT_RATE_LIMIT_UPDATE_PER_MINUTE` | `60` |
| `NUXT_RATE_LIMIT_PASSWORD_PER_MINUTE` | `10` |
| `NUXT_RATE_LIMIT_SLUG_CHECK_PER_MINUTE` | `30` |
| `NUXT_RATE_LIMIT_INVITE_PER_HOUR` | `30` |

Without Redis, each process has its own counters. Use a `rediss://` endpoint
before you run several instances.

## Alerts and jobs

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_ALERTS_INTERVAL_MINUTES` | `15` | In-process sweep interval; zero disables it |
| `NUXT_JOBS_SECRET` | empty | Bearer secret for `POST /api/jobs/alerts` |

The maximum interval is 35,000 minutes. Serverless deployments use zero and an
external scheduler.

## Application analytics

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_PUBLIC_SCRIPTS_GOOGLE_ANALYTICS_ID` | empty | GA4 measurement ID |
| `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_WEBSITE_ID` | empty | Umami website ID |
| `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_HOST_URL` | empty | Self-hosted Umami origin |
| `NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_REPLAYS` | `false` | Loads the Umami recorder |

Each tool turns on when its ID is set. You can use both at the same time.

For Umami Cloud, set only the website ID. For a self-hosted Umami, also set
the host URL. The browser then loads `script.js` from that host and sends
events to it. A host that renames the tracker with `TRACKER_SCRIPT_NAME` is
not supported.

Replays and heatmaps need Umami 3.1.0 or later. Set the replay variable to
`true`, then turn on Replays & Heatmaps in the Umami website settings. The
sample rate, mask level, and block selector are set in Umami. The default
mask level masks only input fields, and the dashboard shows emails and link
destinations. Use the `strict` mask level to mask all text. The heatmap page
preview does not load, because Masir blocks framing and the preview has no
session.

This tracks application page views. It does not run on short-link visitor
responses.

## Sentry

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_PUBLIC_SENTRY_DSN` | empty | Enables error reporting |
| `NUXT_PUBLIC_SENTRY_ENVIRONMENT` | empty | Environment label |
| `NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0` | Trace fraction from zero to one |
| `NUXT_PUBLIC_SENTRY_RELEASE` | image version in Docker | Release name |
| `SENTRY_AUTH_TOKEN` | empty | Authorizes source-map upload |
| `SENTRY_ORG` | empty | Organization slug |
| `SENTRY_PROJECT` | empty | Project slug |
| `SENTRY_URL` | `https://sentry.io/` | Custom Sentry origin |
| `SENTRY_BUILD` | `false` | Build-only module switch |

The Docker image sets `SENTRY_BUILD=true`, includes hidden source maps, and
keeps reporting off until a DSN exists. With upload credentials, the container
creates the release and uploads its maps at startup.

The build also accepts `SENTRY_DSN`, `SENTRY_ENVIRONMENT`,
`SENTRY_RELEASE`, and `SENTRY_TRACES_SAMPLE_RATE` as server-side aliases.

## Seed script

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_EMAIL` | `admin@example.com` | Initial owner email |
| `ADMIN_PASSWORD` | none | Initial owner password |

The server does not read these values. Only `bun run db:seed:admin` uses them.

## Docker Compose

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | none | Required database password |
| `MASIR_APP_PORT` | `3000` | Host application port |
| `MASIR_VERSION` | `latest` | Published image tag |
| `MASIR_DB_PORT` | `5432` | Development database port |
| `MASIR_MAIL_SMTP_PORT` | `1025` | Development Mailpit SMTP port |
| `MASIR_MAIL_UI_PORT` | `8025` | Development Mailpit web port |

Compose passes the database password through `PGPASSWORD`, outside the
connection URL. Changing `POSTGRES_PASSWORD` does not change an existing
Postgres volume password.

