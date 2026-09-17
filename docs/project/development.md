# Development

## Setup

```sh
git clone https://github.com/hamedniroomand/masir.git
cd masir
bun install
cp .env.example .env
```

Point `NUXT_DATABASE_URL` at a Postgres you can lose, then:

```sh
bun run db:migrate
bun run db:seed:admin
bun run dev
```

## With Docker

The development stack runs the app, Postgres, and Mailpit together. The app
reloads when you edit a file on the host.

```sh
docker compose -f compose.dev.yaml up
docker compose -f compose.dev.yaml exec app bun run db:seed:admin
```

The app answers on `http://localhost:3000` and the mail inbox on
`http://localhost:8025`. VS Code users open the same stack with
**Reopen in Container**.

Set `MASIR_APP_PORT`, `MASIR_DB_PORT`, `MASIR_MAIL_SMTP_PORT`, or
`MASIR_MAIL_UI_PORT` in `.env` to publish a different host port.

To run the app on the host and only the services in Docker:

```sh
docker compose -f compose.dev.yaml up -d db mail
```

`compose.yaml` is the production stack. It builds the image, requires
`POSTGRES_PASSWORD`, publishes only the app port, and starts no mail catcher.

## Layout

```text
app/          Vue pages, components, composables
server/
  api/        HTTP handlers, one file per route
  database/   Schema, migrations, client
  middleware/ Workspace resolution, redirect
  utils/      Repositories and helpers
shared/       Code used by both sides
docs/         This site (its own workspace package)
test/
  unit/       Pure functions
  e2e/        Real HTTP against a real build
```

Server code is reached through aliases — `#server/utils/auth`,
`#shared/id` — so a move does not rewrite a hundred relative paths.

`server/utils/*-repo.ts` holds every query for one table. Handlers call
repositories and never write SQL, which is what keeps the workspace argument
impossible to forget.

## Tests

```sh
bun run test              # everything
bun run test -- links     # one file
```

The e2e suite builds **once**, then runs `.output/server/index.mjs` for every
file. Rebuilding per file took 137 seconds; this takes about 20.

Two consequences:

**A code change needs a rebuild.** The suite handles it, but a watch loop does
not give you instant feedback on server code.

**Tests share a Postgres.** Keep the pool small, or twelve files at the default
of 10 connections will exhaust a server that allows 100:

```sh [.env.test]
NUXT_DATABASE_POOL_MAX=2
```

Failures from connection exhaustion look like random flakes. If tests fail
differently on each run, check this before anything else.

### Writing an e2e test

Helpers in `test/e2e/helpers.ts` reset the database and seed a user, an
identity, a workspace, and an owner membership.

Analytics assertions must poll. The click is written after the response through
`event.waitUntil`, so asserting straight after the redirect reads a table that
has not been written yet. Use the `waitFor` helper.

## Migrations

```sh
# after editing server/database/schema.ts
bun run db:generate
bun run db:migrate
```

Read the generated SQL before you apply it. Drizzle infers intent from a diff,
and a rename often comes back as a drop plus an add — which is a rename that
loses the data.

## Before a pull request

```sh
bun run lint
bun run typecheck
bun run test
```

Commits follow Conventional Commits, one line, checked by a hook. `--no-verify`
is not a fix.

## Working on the docs

```sh
bun run docs:dev
```

Pages live in `docs/`, the sidebar in `docs/.vitepress/config.ts`. A new page
needs a sidebar entry, and the build fails on a dead link, so the two cannot
drift apart.

`docs/` is a workspace package with its own `package.json`. One `bun install` at
the root covers both, and the Docker build passes `--filter masir` so the
application image never carries VitePress.
