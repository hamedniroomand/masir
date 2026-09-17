# Scripts

Every command is `bun run <name>`.

## Development

| Script | Does |
|---|---|
| `dev` | Nuxt dev server on port 3000, hot reload |
| `build` | Production build into `.output/` |
| `preview` | Serve the build |
| `lint` | ESLint over the repository |
| `typecheck` | `vue-tsc` over app and server |

`dev` runs through Bun's own runtime (`bun --bun nuxt dev`), which is what makes
`bun:sqlite`-style native APIs available in server code.

## Database

| Script | Does |
|---|---|
| `db:generate` | Write a migration from the schema diff |
| `db:migrate` | Apply pending migrations |
| `db:studio` | Drizzle Studio, a browser client for the data |
| `db:seed:admin` | Create the first account and workspace |

The normal loop after editing `server/database/schema.ts`:

```sh
bun run db:generate   # writes server/database/migrations/NNNN_*.sql
bun run db:migrate    # applies it
```

Read the generated SQL before applying it. Drizzle infers intent from a diff,
and a renamed column can come back as a drop plus an add.

Migrations also run automatically when the server boots, so a deployment does
not need a separate step.

## Tests

```sh
bun run test
```

Vitest, with unit and end-to-end tests in one run.

The e2e suite builds the application **once**, then starts `.output/server/index.mjs`
for the test files. Building per file took 137 seconds; building once takes
about 20.

Both need a reachable Postgres. Tests reset their schema between files, so point
`NUXT_DATABASE_URL` at a database you are willing to lose.

```sh [.env.test]
NUXT_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/masir_test
NUXT_DATABASE_POOL_MAX=2
```

The small pool is not a detail. Twelve test files at the default of 10 open 120
connections against a server that allows 100, and the failures look like random
flakes rather than exhaustion.

## Documentation

The site is its own workspace package under `docs/`, so `vitepress` never
reaches the application image.

```sh
bun run docs:dev      # this site, locally
bun run docs:build    # static output into docs/.vitepress/dist
bun run docs:preview  # serve the built site
```
