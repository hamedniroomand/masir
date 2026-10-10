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

## Deployment and domains

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_ROOT_DOMAIN` | `http://localhost:3000` | Origin of the app and the dashboard |
| `NUXT_PUBLIC_SHORT_DOMAIN` | `http://localhost:3000` | Displayed short-link origin |
| `NUXT_SESSION_COOKIE_SECURE` | `true` | Sends the session only over HTTPS |
| `NUXT_PUBLIC_LOGIN_NOTICE` | empty | Plain text shown above the sign-in form, such as demo credentials |

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
| `NUXT_RATE_LIMIT_REDIRECT_PER_MINUTE` | `120` |
| `NUXT_RATE_LIMIT_CREATE_PER_HOUR` | `30` |
| `NUXT_RATE_LIMIT_UPDATE_PER_MINUTE` | `60` |
| `NUXT_RATE_LIMIT_PASSWORD_PER_MINUTE` | `10` |
| `NUXT_RATE_LIMIT_INVITE_PER_HOUR` | `30` |

`NUXT_RATE_LIMIT_LOGIN_PER_MINUTE` also limits a new user who sets a
password on an invitation.

Without Redis, each process has its own counters. Use a `rediss://` endpoint
before you run several instances.

## Link cache

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_LINK_CACHE_TTL_SECONDS` | `60` | Positive link cache lifetime in seconds; zero disables |
| `NUXT_LINK_CACHE_MISS_TTL_SECONDS` | `15` | Negative link cache lifetime in seconds; zero disables |
| `NUXT_LINK_CACHE_SHARED_INVALIDATION` | `false` | Enables Redis pub/sub invalidation across instances |

## Alerts and jobs

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_ALERTS_INTERVAL_MINUTES` | `15` | In-process sweep interval; zero disables it |
| `NUXT_JOBS_SECRET` | empty | Bearer secret for `POST /api/jobs/alerts` |
| `NUXT_OPERATOR_EMAILS` | empty | Comma-separated user emails allowed to access operator routes |
| `NUXT_READ_ONLY_EMAILS` | empty | Comma-separated user emails that see every page as the owner and an operator, but cannot change anything |

The maximum interval is 35,000 minutes. Use zero and an external scheduler if you want to run the jobs yourself.

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

## Removed variables

Masir 2.0 ignores the variables that served the removed features. You can
delete them from `.env`. See [Upgrade Masir](/guide/upgrading#_1-x-to-2-0) for
the list.

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

