# Production setup

> Run Masir with durable data, trusted network inputs, and a tested recovery path.

The default production stack has two services: Masir and Postgres. Local file
storage adds an uploads volume. Mail, Redis, S3, and Sentry are optional.

## Set the public origins

Set both values to full origins without a trailing slash:

```sh [.env]
NUXT_ROOT_DOMAIN=https://go.example.com
NUXT_PUBLIC_SHORT_DOMAIN=https://go.example.com
NUXT_STORAGE_PUBLIC_BASE_URL=https://go.example.com/uploads
```

`NUXT_ROOT_DOMAIN` controls host resolution and application URLs.
`NUXT_PUBLIC_SHORT_DOMAIN` is printed in short links.

## Add a reverse proxy

Terminate TLS before traffic reaches port `3000`. Forward the original host,
scheme, and client address.

A small Caddy site is enough:

```text [Caddyfile]
go.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Set the exact number of trusted proxies:

```sh [.env]
NUXT_TRUSTED_PROXY_DEPTH=1
```

A value that is too low groups clients under the proxy address. A value that is
too high lets a client forge its address.

## Keep cookies secure

Keep `NUXT_SESSION_COOKIE_SECURE=true` behind HTTPS.

For plain HTTP on a private network, set it to `false`. Do not use that
setting on the public internet.

## Configure email

Invitations, verification, password recovery, and link alerts need email.

<Tabs>

<Tab title="SMTP" icon="server">

```sh [.env]
NUXT_MAIL_DRIVER=smtp
NUXT_MAIL_FROM=Masir <no-reply@example.com>
NUXT_MAIL_SMTP_HOST=smtp.example.com
NUXT_MAIL_SMTP_PORT=587
NUXT_MAIL_SMTP_USER=masir
NUXT_MAIL_SMTP_PASSWORD=<secret>
NUXT_MAIL_SMTP_SECURE=false
```

Use port 465 with `NUXT_MAIL_SMTP_SECURE=true` for implicit TLS.

</Tab>

<Tab title="Resend" icon="mail">

```sh [.env]
NUXT_MAIL_DRIVER=resend
NUXT_MAIL_FROM=Masir <links@example.com>
NUXT_MAIL_API_KEY=<secret>
```

</Tab>

</Tabs>

Without a configured provider, Masir writes messages to the application log.

## Choose storage

The default file driver writes workspace logos below
`./data/uploads`. The Compose stacks mount that path on a named volume.

Use S3-compatible storage when the app has no durable disk or runs on several
instances:

```sh [.env]
NUXT_STORAGE_DRIVER=s3
NUXT_STORAGE_ACCESS_KEY_ID=<key>
NUXT_STORAGE_SECRET_ACCESS_KEY=<secret>
NUXT_STORAGE_BUCKET=masir
NUXT_STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com
NUXT_STORAGE_PUBLIC_BASE_URL=https://assets.example.com
```

Set the endpoint for R2 or another S3-compatible service.

## Share state across instances

Postgres is already shared. Before you run several app instances:

- use S3-compatible storage instead of a local volume
- set `NUXT_REDIS_URL` so rate-limit counters are shared
- route every instance to the same Postgres database
- use the same session and visitor-hash secrets
- keep the same domain configuration

Use a `rediss://` Redis endpoint. Protected actions fail closed when Redis is
unavailable. Redirects continue and skip the limit check.

## Back up and recover

Back up:

1. the Postgres database
2. the uploads volume when you use file storage
3. the deployment files and secret values

Test a restore on another host. A database dump without the uploads loses
workspace logos. An uploads archive without the database loses the storage
keys that name them.

## Alerts and maintenance jobs

Masir runs its maintenance work as jobs. The expiry alert sweep and the demo
sweep are jobs. A long-running instance checks every minute for jobs that are
due. Each job runs every 15 minutes by default.

`POST /api/jobs/alerts` is the single maintenance entry point. Set
`NUXT_JOBS_SECRET` and call:

```sh
curl -X POST https://go.example.com/api/jobs/alerts \
  -H 'Authorization: Bearer <jobs-secret>'
```

When the internal loop is on, a call runs only the jobs that are due. Set
`NUXT_ALERTS_INTERVAL_MINUTES=0` to turn off the internal loop. Each call then
runs every job, and your scheduler sets the interval.

Many instances can call the route at the same time. When the internal loop is
on, a database lock makes sure that each job runs one time for each due time.
The `job_runs` table records the last start, the last success, and the last
error of each job.

## Add monitoring

`GET /api/health` checks the database and returns `503` when it is
unavailable. Use it for uptime checks.

Set `NUXT_PUBLIC_SENTRY_DSN` to enable Sentry. The Docker image includes
hidden source maps. Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and
`SENTRY_PROJECT` to upload them when the container starts.

## Operator responsibilities

Masir does not manage the host for you. Keep the operating system, Docker,
reverse proxy, Postgres, and external services patched. Monitor capacity,
certificate renewal, backups, restores, and release notes.

<ReadMore to="/guide/upgrading" title="Plan a safe upgrade" />

