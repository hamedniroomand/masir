# Vercel

Masir runs on Vercel Functions with the **Bun** runtime. This is not optional:
the application uses Bun's own APIs for password hashing, digests, Postgres,
and object storage, and none of them exist on Node.

## Select the Bun runtime

```json [vercel.json]
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.4.x"
}
```

This is the one setting you cannot skip. `bunVersion` is what makes Functions
run on Bun instead of Node.

::: danger engines.bun is not enough
`engines.bun` in `package.json` selects the toolchain that installs and builds
the project. It does **not** change the function runtime. Without `bunVersion`,
your functions run on Node and every `Bun.*` call fails at runtime, after a
green build.
:::

The Nitro preset switches itself: `vercel` when the build runs on Vercel, `bun`
everywhere else. Those are the only two presets the build accepts.

::: warning Never the edge runtime
The edge runtime is a restricted environment. Bun's APIs, `node:zlib` for QR
codes, and a real Postgres pool all stop working there.
:::

## Settings

```sh
NUXT_DEPLOYMENT_MODE=CLOUD
NUXT_MIGRATE_ON_BOOT=false
NUXT_DATABASE_POOL_MAX=2
NUXT_TRUSTED_PROXY_DEPTH=1
NUXT_STORAGE_BUCKET=masir
NUXT_REDIS_URL=rediss://user:pass@host.upstash.io:6379
```

**Migrations.** A function boots on every cold start, so migrating on boot would
run constantly. Turn it off and migrate as a deploy step against the **direct**
database connection string, not the pooled one:

```sh
bun run db:migrate
```

**Storage.** There is no disk that survives a request. The build marks the
`vercel` preset as serverless, and the boot refuses a disk-backed storage
provider there. A missing bucket stops the deployment instead of losing uploads
later.

**The pool.** Use a plain TCP Postgres connection, not an HTTP driver. Vercel's
Fluid compute keeps an instance alive long enough to reuse connections, which
is what makes the pool worth having. Keep it small.

**Rate limits.** Fluid reuses instances but still scales out, and each instance
starts with empty counters. Without a shared store your sign-in limit
multiplies by the instance count. Set `NUXT_REDIS_URL`.

**The proxy depth.** Vercel sets the client address itself and strips any copy
the client sent, so `1` is correct and stays correct if you later add another
proxy in front.

## Regions

Put the function region and the database region in the same place. A redirect
does one database read, and a cross-ocean round trip is the whole latency
budget.

If your Postgres provider scales to zero, the first redirect after an idle
period pays a cold start. Turn autosuspend off, or accept it.

## Geolocation

Nothing to configure. Masir reads `x-vercel-ip-country` on its own.

## Cron

Expiry alerts need something to run them. A Vercel function stops between
requests, so the in-process sweep never fires there. Leave
`NUXT_ALERTS_INTERVAL_MINUTES` at `0`, set `NUXT_JOBS_SECRET` to a long random
string, and let Vercel Cron call the jobs route.

Add this to `vercel.json`:

```json
{
  "crons": [{ "path": "/api/jobs/alerts", "schedule": "0 * * * *" }]
}
```

Vercel Cron sends its own `Authorization` header only when you set
`CRON_SECRET`. Set `CRON_SECRET` to the same value as `NUXT_JOBS_SECRET` and the
route accepts the call.

Any other scheduler works the same way:

```sh
curl -X POST https://links.example.com/api/jobs/alerts \
  -H "Authorization: Bearer $NUXT_JOBS_SECRET"
```

The route answers `{ "sent": 3 }`. With no secret set it answers `404`.
