# Installation

Masir runs as a single container next to a Postgres database. You can have it
running in about five minutes with Docker Compose. If you would rather run from
source, that works too.

## Requirements

- **Postgres 18 or newer.** Masir uses the native `uuidv7()` function for
  primary keys, and it arrived in Postgres 18. The Compose stack ships the right
  version.
- **Docker**, or **Bun 1.4 or newer** if you build from source.
- **A domain** pointed at the server. Masir needs to know the address people
  will type, and browsers need HTTPS before they accept the session cookie.

## Docker Compose

This is the recommended path. Compose starts Postgres and Masir together and
keeps the data on named volumes.

<Steps>

### Clone and configure

```sh
git clone https://github.com/hamedniroomand/masir.git
cd masir
cp .env.example .env
```

Open `.env` and set these three values. Everything else has a working default.

```sh [.env]
# Letters and digits only. openssl rand -hex 24
POSTGRES_PASSWORD=

# 32 characters or more. openssl rand -base64 32
NUXT_SESSION_PASSWORD=

# The address people will type, with protocol
NUXT_ROOT_DOMAIN=https://go.example.com
NUXT_PUBLIC_SHORT_DOMAIN=https://go.example.com
```

### Start the stack

```sh
docker compose up -d --build
```

Masir waits for Postgres to pass its health check, applies the database
migrations, and starts listening on port 3000.

### Create the first account

```sh
docker compose exec app bun run db:seed:admin
```

The seed reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`. It creates
the first user, the first workspace, and the owner membership that connects
them. Sign in at `/login`.

</Steps>

::: tip Migrations run on boot
Every start applies the migrations the database is missing, under a Postgres
advisory lock, so several instances apply them once. After an upgrade you
restart and you are done.
:::

Postgres is not published to the host. The app reaches it over the Compose
network. Data lives on the `masir_db-data` volume and uploaded logos on
`masir_uploads`.

## From source

Use this when you want to run Masir on a machine without Docker, or when you
plan to work on the code.

```sh
git clone https://github.com/hamedniroomand/masir.git
cd masir
cp .env.example .env
bun install
```

Point `NUXT_DATABASE_URL` in `.env` at a Postgres 18 database. If you do not
have one, the development stack publishes one on localhost:

```sh
docker compose -f compose.dev.yaml up -d db
```

Then migrate, seed, and build:

```sh
bun run db:migrate
bun run db:seed:admin
bun run build
bun .output/server/index.mjs
```

The server listens on port 3000. For a development server with hot reload, see
[Development](/project/development).

## Check that it works

```sh
curl -s http://localhost:3000/api/health
```

```json
{ "ok": true, "database": "up" }
```

A `503` means the app is running but cannot reach Postgres. Check
`NUXT_DATABASE_URL`.

## If it refuses to start

Masir validates its configuration before it does anything else. A missing or
invalid value stops the process and names the variable in the first log line:

```text
Error: Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)
```

Fix the value and start again. The [troubleshooting page](/guide/troubleshooting)
lists the common ones.

## Next steps

<CardGroup :cols="2">

<Card title="Your first link" icon="rocket" to="/guide/quickstart">

Create a link and change where it points.

</Card>

<Card title="Sending email" icon="key-round" to="/guide/authentication#sending-email">

Invitations and password recovery need a mail provider.

</Card>

<Card title="Self-hosting" icon="server" to="/guide/self-hosting">

Proxies, backups, scaling, and error reporting.

</Card>

<Card title="Environment variables" icon="settings" to="/reference/environment">

Every setting, with its default.

</Card>

</CardGroup>
