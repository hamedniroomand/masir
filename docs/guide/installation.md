# Installation

Masir needs Postgres 17 or newer and, if you are building from source,
[Bun](https://bun.com) 1.4 or newer.

## With Docker Compose

The fastest path. Compose brings up Postgres and the app together.

```sh
git clone https://github.com/hamedniroomand/masir
cd masir
cp .env.example .env
```

Open `.env` and set two values before you start anything:

```sh [.env]
# 32 characters or more — openssl rand -base64 32
NUXT_SESSION_PASSWORD=

# The origin people will type, with protocol and port
NUXT_ROOT_DOMAIN=https://go.example.com
```

Then bring it up and create the first account:

```sh
docker compose up -d --build
docker compose exec app bun run db:seed:admin
```

The seed reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`, and creates
the first user, the first workspace, and the owner membership that ties them
together. Sign in at `/login`.

::: tip
Migrations run when the app boots, under an advisory lock so several
instances apply them once. You do not need to run them by
hand after an upgrade.
:::

## From source

```sh
git clone https://github.com/hamedniroomand/masir
cd masir
cp .env.example .env
bun install
```

Point `NUXT_DATABASE_URL` at a Postgres you already run, or start one:

```sh
docker compose up -d db
```

Then migrate, seed, and start:

```sh
bun run db:migrate
bun run db:seed:admin
bun run dev
```

## Verify the install

```sh
curl -s http://localhost:3000/api/health
```

```json
{ "ok": true, "database": "up" }
```

A `503` here means the app started but cannot reach Postgres. Check
`NUXT_DATABASE_URL`.

## Boot-time validation

Masir refuses to start on a bad configuration rather than failing later in a
confusing way. Every message names the variable:

```text
Error: Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)
```

If the app exits immediately, read the first line of the log. It usually tells
you exactly which value to fix.

<ReadMore to="/guide/quickstart" title="Create your first link" />
