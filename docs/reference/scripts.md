# Scripts

Every command is `bun run <name>` from the repository root.

## Day to day

| Script | Does |
|---|---|
| `dev` | Start the development stack in Docker: app with hot reload, Postgres, and Mailpit |
| `build` | Production build into `.output/` |
| `preview` | Serve the last build |
| `lint` | ESLint over the repository |
| `typecheck` | `vue-tsc` over app and server |

`dev` is a shortcut for `docker compose -f compose.dev.yaml up`. To run the app
on the host and keep only Postgres and Mailpit in Docker:

```sh
docker compose -f compose.dev.yaml up -d db mail
bun --bun nuxt dev
```

## Database

| Script | Does |
|---|---|
| `db:generate` | Write a migration from the schema diff |
| `db:migrate` | Apply pending migrations |
| `db:studio` | Drizzle Studio, a browser client for the data |
| `db:seed:admin` | Create the first account and workspace |

The loop after editing `server/database/schema.ts`:

```sh
bun run db:generate   # writes drizzle/<timestamp>_<name>/migration.sql
bun run db:migrate    # applies it
```

Read the generated SQL before you apply it. Drizzle infers intent from a diff,
and a renamed column can come back as a drop plus an add, which loses the data.

Migrations also run when the server boots, so a deployment needs no separate
step. `db:migrate` and `db:seed:admin` both work inside the production image.

## Tests

| Script | Does |
|---|---|
| `test` | Unit and end-to-end tests in one Vitest run |
| `test:coverage` | The same, with a coverage report in `coverage/` |
| `test:browser` | Build, then run the Playwright suite |
| `test:browser:run` | Run Playwright against the last build |

`test` and `test:coverage` start the `db` service from the development stack
first and wait for it. They skip that step under `CI` and on a machine without
Docker, where Postgres comes from somewhere else.

The tests read `TEST_DATABASE_URL`, never `NUXT_DATABASE_URL`. They create one
database per test file from it, named `masir_test_<file>`, and keep them between
runs. The development stack creates the `masir_test` database on its first
start.

The end-to-end suite builds the application **once**, then starts a server from
`.output` for each test file. This is the same artifact that Docker runs.

Browser tests start one server per deployment shape: `single`, `multi`, and
`cloud`. Run one shape with `--project`:

```sh
bun run test:browser:run --project multi
```

<ReadMore to="/project/development#tests" title="How the test suite is put together" />

## Documentation

The docs site is its own workspace package under `docs/`, so VitePress never
reaches the application image.

| Script | Does |
|---|---|
| `docs:dev` | This site, locally, with hot reload |
| `docs:build` | Static output into `docs/.vitepress/dist` |
| `docs:preview` | Serve the built site |
