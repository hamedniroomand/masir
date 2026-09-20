# Scripts

> Run these commands from the repository root with Bun 1.4 or newer.

The command form is `bun run <name>`.

## Application

| Script | Result |
|---|---|
| `dev` | Starts the Docker development stack with hot reload, Postgres, and Mailpit |
| `build` | Creates the production application in `.output/` |
| `preview` | Runs the most recent Nuxt build |
| `lint` | Checks the repository with ESLint |
| `typecheck` | Checks application and server types |

To run the app on the host while Docker supplies Postgres and Mailpit:

```sh
docker compose -f compose.dev.yaml up -d db mail
bun --bun nuxt dev
```

## Database

| Script | Result |
|---|---|
| `db:generate` | Creates a Drizzle migration from the schema difference |
| `db:migrate` | Applies pending migrations and prepares event partitions |
| `db:studio` | Opens Drizzle Studio |
| `db:seed:admin` | Creates the initial user, workspace, and owner membership |

After a schema change:

```sh
bun run db:generate
bun run db:migrate
```

Read generated SQL before you apply it. A rename can appear as a destructive
drop and add when the migration tool cannot infer intent.

## Tests

| Script | Result |
|---|---|
| `test` | Runs unit and server end-to-end tests |
| `test:coverage` | Runs the same suite with V8 coverage |
| `test:browser` | Builds the app, then runs Playwright |
| `test:browser:run` | Runs Playwright against the existing build |

The server tests read `TEST_DATABASE_URL`. They create one isolated database
for each test file and do not use the application database.

Browser tests cover single-workspace, multi-workspace, and cloud shapes. Run
one shape with:

```sh
bun run test:browser:run --project multi
```

## Documentation

| Script | Result |
|---|---|
| `docs:dev` | Starts VitePress with hot reload |
| `docs:build` | Builds the static site in `docs/.vitepress/dist` |
| `docs:preview` | Serves the built documentation |

The docs are a separate workspace package. They do not enter the application
image.

