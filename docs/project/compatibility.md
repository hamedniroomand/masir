# Compatibility and releases

Masir runs on machines we do not control. An operator upgrades when they
choose, skips versions, and cannot ask us to fix their database. Every change
follows the rules on this page. A change that cannot follow them waits for a
major release.

The model is simple to state: the server upgrades itself on boot, an operator
can jump from any tagged version to the latest, each upgrade step is
idempotent, and every release ships with upgrade notes.

## Versioning

Masir uses semantic versioning. The version lives in `package.json`, in the git
tag `vX.Y.Z`, and in the Docker image tag.

| Bump | Allowed | Not allowed |
|---|---|---|
| Patch `x.y.Z` | Bug fixes. Security fixes. Docs. | Schema changes. New env vars. Behaviour changes. |
| Minor `x.Y.0` | New features. Additive migrations. New env vars with defaults. Deprecations. | Removals. Renames without an alias. Required new config. |
| Major `X.0.0` | Removal of things deprecated for at least one minor. New required config. Higher Postgres or Bun minimum. | Silent data loss. |

Every tagged version upgrades directly to the latest. An operator never steps
through intermediate releases. This holds as long as migration history is
never rewritten, and the rules below protect it.

Downgrades are not supported. The upgrade guide tells the operator to back up
first, and a release that changes the schema repeats that line.

## Database

Postgres is the only state. Everything here is about keeping an operator's rows
intact through a version jump and a rolling deploy. The rules apply from the
first tagged release, whose initial migration is the first frozen one.

**Every schema change is a Drizzle migration.** Edit
`server/database/schema.ts`, run `bun run db:generate`, and read the SQL before
you commit it. Drizzle infers intent from a diff, and a renamed column comes
back as a drop plus an add, which deletes the data.

**Never edit or delete a migration that has shipped.** A migration in a tagged
release is frozen, including its snapshot. Fix it with a new migration. The
migrator applies files in order and skips the ones it has seen, so a rewritten
file breaks every instance that already ran the old one.

**Additive in release N, destructive in N+1 or later.** Migrations run on
boot, and a rolling deploy runs old code against the new schema for a while. So
one release only adds. Removals wait at least one minor and land in a major.

- A new column is nullable, or `NOT NULL` with a `DEFAULT`. Never `NOT NULL`
  alone on a table that has rows.
- A rename adds the new column, backfills, reads and writes both, then drops
  the old one in a later major.
- A change of type or meaning is treated like a rename. Never
  `ALTER COLUMN ... TYPE` on a populated column.
- A new constraint or unique index on existing data repairs the data first, in
  the same or an earlier migration, so it cannot fail on rows you have never
  seen.
- A drop of a table or column happens only in a major, only after the code
  stopped using it one minor earlier, and only with a line under **Removed** in
  the changelog.

**Backfills are idempotent and self-contained.** A backfill is SQL inside the
migration, or a step that is safe to run twice. It does not import application
code, because that code changes and the migration must still work in five
years. An interrupted upgrade resumes on the next boot.

**Do not hold long locks.** The migrator runs each file in one transaction
under an advisory lock, and the whole instance waits for it. A statement that
rewrites a large table blocks every request on every instance. Add the index or
column in a way Postgres can do without a rewrite, or batch the backfill.
`CREATE INDEX CONCURRENTLY` cannot run in a transaction and needs a step outside
the migrator.

**Keep the seed and fixtures idempotent.** `db:seed:admin` and the test helpers
run against schemas from any version. They insert with `on conflict do nothing`
and never assume an empty table.

## Configuration

Operators read the environment reference once and then copy an `.env` between
upgrades. That file must keep working.

- **Every new variable has a working default.** A variable that must be set is
  a breaking change. It waits for a major, and the boot check names it in the
  first log line.
- **Never rename or remove a variable in a minor.** Read both names, prefer the
  new one, and log one warning naming the old one and the release that removes
  it. Remove the alias in the next major at the earliest.
- **Never change a default in a minor.** A different default is a different
  behaviour for someone who never set the variable. Ship the new behaviour
  behind a variable that defaults to the old one, and flip the default in a
  major.
- **Validate at boot, not at first use.** `server/utils/config-assert.ts` is
  the one place. A bad value stops the process with the variable name before
  any migration runs.
- **Document every variable in the same commit** that adds it, in the
  [environment reference](/reference/environment), with its default.

The same rules apply to the Docker contract: port `3000`, the `bun` user, the
`.output` start command, the `./data/uploads` path, and the Compose service
names. Changing one of them is a major.

## Behaviour operators and visitors depend on

Some behaviour is a promise, not a feature. Changing it breaks links printed on
paper or scripts an operator wrote.

- **Redirects.** A slug that resolved before an upgrade resolves after it. The
  status code, the handling of query strings, and the UTM behaviour do not
  change in a minor.
- **HTTP API.** Routes under `/api` only gain. A new field is optional. A
  removed or renamed field or route is deprecated one minor first, documented
  under **Deprecated**, and removed in a major.
- **Sessions.** An upgrade does not sign everybody out unless the release notes
  say so and say why. Changing the session payload means reading the old shape
  too.
- **Stored secrets.** Password hashes, token hashes, and visitor hashes verify
  in every format ever written. A new algorithm rehashes on the next successful
  use and never invalidates the old rows.
- **Uploaded files.** Storage keys and URLs already handed out keep resolving.
  A new key scheme reads the old one as a fallback.
- **Mail and storage drivers.** A driver name that worked keeps working.

## Feature flags for risky changes

A change that alters behaviour for existing data ships in three steps across
releases: a variable that defaults to the old behaviour, then a minor that
flips the default with a line under **Changed**, then a major that removes the
variable. Skip the first step only when the old behaviour was a bug.

## Changelog

`CHANGELOG.md` at the repository root follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). It has an
`Unreleased` section on top and one section per tagged version below it.

Every pull request that touches one of these adds a line under `Unreleased` in
the same PR:

- a migration
- an environment variable, its default, or the Docker contract
- a route, a response field, or a redirect rule
- anything a user sees

The line goes under one heading: `Added`, `Changed`, `Deprecated`, `Removed`,
`Fixed`, or `Security`. A PR that changes only tests, docs, or internals adds
nothing. Commit messages say what changed in the code. The changelog says what
changed for the operator.

A release that needs an action from the operator also gets an **Upgrade notes**
block under its version heading: back up first, set this variable, expect this
migration to take time above this table size. The
[upgrading guide](/guide/upgrading#version-notes) mirrors those notes so an
operator jumping several releases reads them in one place.

## Release checklist

1. Move `Unreleased` in `CHANGELOG.md` to a version heading with today's date.
   Write the upgrade notes.
2. Bump `version` in `package.json` to match.
3. Run `bun run lint`, `bun run typecheck`, and `bun run test` on a clean
   checkout.
4. Run the upgrade test: apply the migrations on top of the schema of the
   previous tag with seeded rows, boot the server, and hit `/api/health`.
5. Tag `vX.Y.Z`. Build the image, tag it with the version and `latest`, push
   both.
6. Publish the release on GitHub with the changelog section as the body.

A release never ships from a branch other than `main`, and never with a dirty
`Unreleased` section left behind.

## Pull request checklist

Answer each line before you ask for review. A "no" on any of them means the PR
is not ready or belongs in a major.

- Does the migration only add? Is the generated SQL what I meant?
- Does old code, still running during the rolling deploy, work against the new
  schema?
- Does an `.env` from the previous release boot this build unchanged?
- Does every new env var have a default and a row in the environment
  reference?
- Does every slug, route, field, session, hash, and file key that worked
  yesterday work today?
- Is the changelog line written, under the right heading?
- Is the destructive half of this change, if any, scheduled for a major and
  noted under `Deprecated`?

## What we do not promise

Downgrades. Direct edits to the database by an operator. Versions that were
never tagged. Postgres below the minimum named in the installation guide.
Behaviour the docs describe as internal.
