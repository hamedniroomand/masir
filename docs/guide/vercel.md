# Vercel

Masir runs on Vercel Functions using **Bun**, not Node. That matters: the
application uses Bun's own APIs for password hashing, digests, Postgres and
object storage, and none of them exist on Node.

## Select the Bun runtime

```json [vercel.json]
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.4.x"
}
```

This is the one setting you cannot skip. Vercel's docs are explicit that
`bunVersion` is what makes Functions run on Bun instead of Node.

::: danger engines is not a substitute
`engines.bun` in `package.json` selects the toolchain that installs and builds
your project. It does **not** change the function runtime. Without
`bunVersion`, your functions run on Node and every `Bun.*` call fails at
runtime — after a green build.
:::

The Nitro preset switches itself: `vercel` when the build runs on Vercel, `bun`
everywhere else. `bun` and `vercel` are the only presets the build accepts.

::: warning Never vercel-edge
The edge runtime is a restricted environment. Bun's APIs, `node:zlib` for QR
codes and a real Postgres pool all stop working there.
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

**Migrations.** A function boots on every cold start, so boot migration would
run them constantly. Turn it off and migrate as a deploy step against the
**direct** Neon connection string, not the pooled one.

```sh
bun run db:migrate
```

**Storage.** There is no disk that survives a request. The build marks the
`vercel` preset as serverless, and the boot refuses a disk-backed provider
there and names the variable, so a missing bucket stops the deployment
instead of losing uploads later.

**The pool.** Use a plain TCP Postgres connection, not Neon's HTTP driver.
Fluid keeps an instance alive long enough to close idle connections, which is
what makes the pool worth having. Keep it small.

**The proxy depth.** Vercel sets the client address itself and strips any
client copy, so Masir reads it directly on Vercel. Setting `1` keeps the
behaviour correct if you later move behind another proxy.

## Regions

Put the function region and the Neon region in the same place. A redirect does
one database read, and a cross-ocean round trip is the whole latency budget.

Neon's scale-to-zero adds a cold start to the first redirect after an idle
period. Disable autosuspend, or accept it.

## Geolocation

Nothing to configure. Masir already reads `x-vercel-ip-country`.

## What you still owe

Rate limiting needs `NUXT_REDIS_URL`. Fluid reuses instances but scales
horizontally, and each instance starts with empty counters, so without it your
sign-in limit multiplies by the instance count.
