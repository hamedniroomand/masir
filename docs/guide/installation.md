# Install Masir

> Start Masir with Postgres, create the first owner, and verify the deployment.

The published Docker image is the recommended production path. A local build
and a source install are also supported.

## Before you begin

You need:

- a Linux server with Docker and Docker Compose, or Bun 1.4 or newer
- Postgres 18 or newer
- a domain that points to the server
- HTTPS for production sign-in

The included Compose stacks use Postgres 18 and keep the database off the
public network.

## Quick install

The installer supports a new Linux server. It installs Docker when needed,
downloads the published stack, generates secrets, and starts Masir.

```sh
curl -fsSL https://raw.githubusercontent.com/hamedniroomand/masir/main/scripts/install.sh | sh
```

It asks for the public origin, such as `https://go.example.com`. The result is
stored in a new `masir` directory.

## Published Docker image

Use this path when you want release images from GitHub Container Registry.

<Steps>

### Download the deployment files

```sh
mkdir masir && cd masir
curl -fsSLO https://raw.githubusercontent.com/hamedniroomand/masir/main/compose.image.yaml
curl -fsSL https://raw.githubusercontent.com/hamedniroomand/masir/main/.env.example -o .env
```

### Set the required values

Generate two different secrets:

```sh
openssl rand -hex 24
openssl rand -base64 32
```

Open `.env` and set:

```sh [.env]
POSTGRES_PASSWORD=<first-secret>
NUXT_SESSION_PASSWORD=<second-secret>
NUXT_ROOT_DOMAIN=https://go.example.com
NUXT_PUBLIC_SHORT_DOMAIN=https://go.example.com
NUXT_STORAGE_PUBLIC_BASE_URL=https://go.example.com/uploads
```

Set `MASIR_VERSION` to a release number if you do not want `latest`.

### Start the stack

```sh
docker compose -f compose.image.yaml up -d
```

### Create the first owner

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:

```sh
docker compose -f compose.image.yaml exec app bun run db:seed:admin
```

Change the initial password after you sign in.

</Steps>

## Build the image

Use the repository Compose file when you run a fork or an unreleased change.

```sh
git clone https://github.com/hamedniroomand/masir.git
cd masir
cp .env.example .env
```

Set the same required values as the published-image path, then run:

```sh
docker compose up -d --build
docker compose exec app bun run db:seed:admin
```

The stack waits for Postgres, applies pending migrations, and starts Masir on
port `3000` by default.

## Run from source

Use this path for development or a host where you manage the runtime.

```sh
git clone https://github.com/hamedniroomand/masir.git
cd masir
cp .env.example .env
bun install
docker compose -f compose.dev.yaml up -d db mail
```

Set `NUXT_DATABASE_URL` to the Postgres 18 database. Then run:

```sh
bun run db:migrate
bun run db:seed:admin
bun run build
bun .output/server/index.mjs
```

Use `bun --bun nuxt dev` instead of the last two commands for hot reload.

## Verify the installation

Check the app directly before you configure a reverse proxy:

```sh
curl -fsS http://localhost:3000/api/health
```

Expected result:

```json
{"ok":true,"database":"up"}
```

A `503` means that Masir is running but cannot reach Postgres. Check
`NUXT_DATABASE_URL`, the database health, and the container network.

## Put HTTPS in front

Point your reverse proxy at port `3000`. Forward the original host and scheme.
Set `NUXT_TRUSTED_PROXY_DEPTH=1` when exactly one proxy sits in front of Masir.

Keep `NUXT_SESSION_COOKIE_SECURE=true` in production. Plain HTTP is supported
only on a private network when you set it to `false`.

## Production checklist

- Pin `MASIR_VERSION` to a release.
- Store `.env` outside version control.
- Use a different session secret and database password.
- Configure HTTPS and the correct public origins.
- Configure mail before you invite users or use password recovery.
- Back up Postgres and the uploads volume.
- Test an upgrade on a copy of production data.

## Startup errors

Masir validates its configuration before it accepts traffic. The first error
line names the invalid variable. Fix it and restart the app.

```text
Error: Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)
```

<ReadMore to="/guide/quickstart" title="Create your first link" />

