# Deploy on Vercel

> Run the Bun server on Vercel with external Postgres, object storage, and a scheduled alert job.

Vercel keeps no durable application disk. Use S3-compatible storage and run
migrations as a deployment step.

## Use the Bun runtime

The repository `vercel.json` selects Bun 1.4 and the `iad1` region. The
Nuxt build selects the Vercel Nitro preset when the platform environment is
present.

## Connect Postgres

Use Postgres 18 or newer. Set `NUXT_DATABASE_URL` to a pooled runtime
connection and keep `NUXT_DATABASE_POOL_MAX` small.

Use a direct connection for `bun run db:migrate` during deployment.

## Set the runtime values

At minimum, configure:

```sh
NUXT_SESSION_PASSWORD=<32-or-more-random-characters>
NUXT_DATABASE_URL=<pooled-postgres-url>
NUXT_MIGRATE_ON_BOOT=false
NUXT_ROOT_DOMAIN=https://go.example.com
NUXT_PUBLIC_SHORT_DOMAIN=https://go.example.com
NUXT_SERVERLESS=true
```

Also configure S3-compatible storage. The file provider is rejected on a
serverless deployment because its data would disappear.

## Configure location data

Vercel adds the `x-vercel-ip-country` header. Set:

```sh
NUXT_GEO_COUNTRY_HEADER=x-vercel-ip-country
```

Country targeting and analytics will then use the platform value.

## Schedule alerts

Set `NUXT_ALERTS_INTERVAL_MINUTES=0` and a strong `NUXT_JOBS_SECRET`.

Configure a scheduler to send `POST /api/jobs/alerts` with:

```text
Authorization: Bearer <NUXT_JOBS_SECRET>
```

This route is the single maintenance entry point. Each call runs every
maintenance job, such as the expiry alert sweep and the demo sweep. With the
internal loop off, two calls at the same time can run the same job at the same
time. Each sweep claims its rows, so no alert goes out two times.

The route returns `404` when no secret is configured and `401` for a wrong
secret.

## Review serverless tradeoffs

- Cold starts create new database pools.
- In-memory rate limits do not span instances. Configure Redis.
- Local uploads do not persist. Configure S3-compatible storage.
- In-process timers do not persist. Configure the alert job.
- Migrations must run outside request startup.

<ReadMore to="/reference/environment" title="Review every runtime value" />

