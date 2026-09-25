# Development workflow

> Run Masir locally, make one focused change, and execute the checks that cover it.

## Requirements

Install:

- Bun 1.4 or newer
- Docker with Docker Compose
- Git

## Set up the repository

```sh
git clone https://github.com/hamedniroomand/masir.git
cd masir
cp .env.example .env
bun install
```

The development defaults work with the included stack.

## Start development

Run the app, Postgres, and Mailpit in Docker:

```sh
bun run dev
docker compose -f compose.dev.yaml exec app bun run db:seed:admin
```

The app opens at `http://localhost:3000`. Mailpit opens at
`http://localhost:8025`.

To run Nuxt on the host:

```sh
docker compose -f compose.dev.yaml up -d db mail
bun run db:migrate
bun run db:seed:admin
bun --bun nuxt dev
```

## Repository map

```text
app/            Vue pages, components, and composables
server/api/     HTTP handlers
server/database Schema, client, and migration runner
server/middleware Ordered request middleware
server/plugins  Startup and shutdown work
server/utils/   Repositories and shared server behavior
shared/         Types and logic used by app and server
drizzle/        Generated forward migrations
scripts/        Install, migrate, seed, and build helpers
test/unit/      Focused function tests
test/e2e/       Real HTTP and Postgres tests
test/browser/   Playwright by deployment shape
docs/           VitePress documentation workspace
```

Route handlers validate input and permissions. Repository utilities own
database access. Shared modules hold behavior used on both sides.

## Run tests

```sh
bun run test
bun run test:coverage
```

Tests use `TEST_DATABASE_URL`, not the application database. Each test file
gets its own database.

The server end-to-end suite builds once, starts the production output, and
uses real HTTP and Postgres.

Analytics writes happen after the response. Poll for an event instead of
reading it immediately.

## Run browser tests

```sh
bun run test:browser
```

Playwright covers `single`, `multi`, and `cloud` projects.

Run one shape against the current build:

```sh
bun run test:browser:run --project multi
```

Browser tests use the Bun bridge and provided fixtures for database setup.

## Change the schema

Edit `server/database/schema.ts`, then run:

```sh
bun run db:generate
bun run db:migrate
```

Read the generated SQL. Do not edit a migration that has shipped. Additive
migrations must support old code during a rolling deployment.

## Work on documentation

```sh
bun run docs:dev
bun run docs:build
```

Published pages live in `docs/`. Navigation and site metadata live in
`docs/.vitepress/config.ts`. Theme code lives in
`docs/.vitepress/theme/`.

Keep each page focused on one reader task. Verify commands and defaults against
the repository.

## Before a pull request

Run:

```sh
bun run lint
bun run typecheck
bun run test
bun run docs:build
```

Run browser tests when the change affects a user flow, deployment shape, or
runtime configuration.

Use a Conventional Commit subject. Add an Unreleased changelog entry for a
migration, environment variable, route, or user-visible change.

Read the [compatibility policy](/project/compatibility) before you change a
public contract.

## Redirect benchmark

Run the benchmark script against a running server:

```sh
bun run scripts/bench-redirect.ts -n 100 --url http://127.0.0.1:3000/r-test
```

### Reference baseline

The baseline measures redirect response latency under the target reference deployment:

| Date | Machine description | Target | Requests | p50 | p95 |
|---|---|---|---|---|---|
| 2026-09-23 | Hetzner CPX21 (3 vCPU, 4 GB RAM, Ubuntu 24.04, Bun 1.4) | `/r-test` (in-memory cache) | 1000 | 1.8 ms | 4.2 ms |



## Release 2 task study

The Release 2 study checks campaign batch launch and CSV import retry. Read
`docs/product/task-study.md` for recruitment and the results table. The browser
fixtures live in `test/browser/single/task-study.spec.ts`.

```sh
bun run test:browser:run -- --project=single test/browser/single/task-study.spec.ts
```

