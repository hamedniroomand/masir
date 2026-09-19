# Upgrading

Masir upgrades itself. You start the new version, it applies whatever the
database is missing, and it serves. This page covers what to do around that
step.

## Before every upgrade

Back up the database. It is the only durable state, and there is no downgrade
path.

```sh
pg_dump "$NUXT_DATABASE_URL" > masir-$(date +%F).sql
```

Then read the **Upgrade notes** for every version between yours and the one you
install. They live in the
[changelog](https://github.com/hamedniroomand/masir/blob/main/CHANGELOG.md) and
are mirrored under [Version notes](#version-notes) below. Most releases have
none. A release that needs a new variable, or that will take time on a large
table, says so there.

## Upgrade

Pin to a version rather than tracking `latest` or `main`, so an upgrade is
something you do on purpose.

With the published image, set `MASIR_VERSION` in `.env` and pull:

```sh
docker compose -f compose.image.yaml pull
docker compose -f compose.image.yaml up -d
```

The quick install script writes the stack as `compose.yaml`, so drop the `-f`
there. With a build of your own, check out the tag and rebuild:

```sh
git fetch --tags
git checkout v1.2.0
docker compose up -d --build
```

Migrations run on boot under a Postgres advisory lock. A rolling deploy or
`docker compose up --scale app=3` applies them once, and the other instances
wait. Old instances keep serving against the new schema until they stop,
because a release only adds to the schema.

## Skipping versions

You can jump from any tagged version straight to the latest. Migrations are
incremental and never rewritten, so the server applies every step you missed in
order. Do read the upgrade notes for the versions you skipped. The migrations
do not read them for you.

## On serverless

With `NUXT_MIGRATE_ON_BOOT=false`, nothing migrates on its own. Run the
migration as a deploy step against the direct connection string, before the new
build takes traffic:

```sh
bun run db:migrate
```

## If something goes wrong

**The server refuses to start.** The first log line names the problem. A bad
environment variable is a configuration error: fix the value and start again.

**A migration fails.** The database stays at the last completed step. Report
the log line, then start the previous version again. It runs against the
partial schema, because a migration only adds.

**You need to go back further.** Restore the backup and start the previous
version.

## Version notes

No version has been tagged yet. Each release adds a heading here with the
actions it needs, and only those.
