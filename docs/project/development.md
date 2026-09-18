# Development

Everything you need to run Masir locally, change it, and test it.

## Setup

```sh
git clone https://github.com/hamedniroomand/masir.git
cd masir
cp .env.example .env
bun install
```

The defaults in `.env.example` work with the development stack as they are.

## Running it

The quickest way is the development stack. It runs the app with hot reload,
Postgres, and Mailpit together, and reloads when you edit a file on the host:

```sh
bun run dev
docker compose -f compose.dev.yaml exec app bun run db:seed:admin
```

The app answers on `http://localhost:3000` and the mail inbox on
`http://localhost:8025`. VS Code users can open the same stack with
**Reopen in Container**.

To run the app on the host and keep only the services in Docker:

```sh
docker compose -f compose.dev.yaml up -d db mail
bun run db:migrate
bun run db:seed:admin
bun --bun nuxt dev
```

Set `MASIR_APP_PORT`, `MASIR_DB_PORT`, `MASIR_MAIL_SMTP_PORT`, or
`MASIR_MAIL_UI_PORT` in `.env` to publish a different host port.

## Layout

```text
app/            Vue pages, components, composables
server/
  api/          HTTP handlers, one file per route
  database/     Schema and client
  middleware/   Workspace resolution, redirect, origin check
  plugins/      Boot: config check, migrations, shutdown
  utils/        Repositories and helpers
shared/         Code used by both sides
drizzle/        Generated migrations
scripts/        migrate and seed-admin
test/
  unit/         Pure functions
  e2e/          Real HTTP against a real build
  browser/      Playwright, one folder per deployment shape
docs/           This site, its own workspace package
```

Server code is imported through aliases such as `#server/utils/auth` and
`#shared/slug`, so a move does not rewrite a hundred relative paths.

`server/utils/*-repo.ts` holds every query for one table. Handlers call
repositories and never write SQL, which is what keeps the workspace argument
impossible to forget.

## Tests

```sh
bun run test              # everything
bun run test -- links     # files matching "links"
```

The tests read `TEST_DATABASE_URL`, never `NUXT_DATABASE_URL`. It points at the
`masir_test` database that the development stack creates on its first start,
and each test file gets its own `masir_test_<file>` next to it. The application
database is never touched. `bun run test` starts the `db` service first and
waits for it.

The end-to-end suite builds **once**, then runs `.output/server/index.mjs` for
every file. Two things follow:

- **A code change needs a rebuild.** The suite handles it, but a watch loop
  does not give instant feedback on server code.
- **Tests share a Postgres.** Keep the pool small. Twelve files at the default
  of 10 connections exhaust a server that allows 100, and the failures look
  like random flakes. Set `NUXT_DATABASE_POOL_MAX=2` for tests if you see that.

### Browser tests

`bun run test:browser` runs Playwright against the same build, once per
deployment shape. Every behaviour an operator can switch on with an environment
variable has a project: `single`, `multi`, and `cloud`, each with its own
server and database. A spec that only holds in one shape lives in that shape's
folder under `test/browser/`.

Playwright runs on Node and the database helpers need Bun, so specs seed
through `test/browser/bridge.ts`, a Bun script that prints one JSON line. Use
the `db` fixture, never a direct connection.

### Writing an end-to-end test

Helpers in `test/e2e/helpers.ts` reset the database and seed a user, an
identity, a workspace, and an owner membership.

Analytics assertions must poll. The click is written after the response, so
asserting straight after the redirect reads a table that has not been written
yet. Use the `waitFor` helper.

### Coverage

`bun run test:coverage` writes a report to `coverage/`. The end-to-end server
runs in its own process, so the report only holds code the test process
imports: `shared/`, `server/utils/`, and `app/composables/`. Route and page
modules read low for that reason, and only `shared/` has a threshold. CI runs
this command.

## Migrations

```sh
# after editing server/database/schema.ts
bun run db:generate
bun run db:migrate
```

Read the generated SQL before you apply it. Drizzle infers intent from a diff,
and a rename often comes back as a drop plus an add, which is a rename that
loses the data. The [compatibility rules](/project/compatibility) say what a
migration may and may not do once it has shipped.

## Before a pull request

```sh
bun run lint
bun run typecheck
bun run test
```

Commits follow Conventional Commits, one line, checked by a hook. `--no-verify`
is not a fix.

If your change touches a migration, an environment variable, a route, or
anything a user sees, add a line under **Unreleased** in `CHANGELOG.md`.

## Working on the docs

```sh
bun run docs:dev
```

Pages live in `docs/`, the sidebar in `docs/.vitepress/config.ts`. A new page
needs a sidebar entry, and the build fails on a dead link, so the two cannot
drift apart.

`docs/` is a workspace package with its own `package.json`. One `bun install`
at the root covers both, and the Docker build passes `--filter masir` so the
application image never carries VitePress.
