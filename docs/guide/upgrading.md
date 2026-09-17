# Upgrading

Masir upgrades itself. You start the new version, it applies what the database
is missing, and it serves. This page tells you what to do around that step.

## Before every upgrade

Back up the database. It is the only state, and there is no downgrade.

```sh
pg_dump "$NUXT_DATABASE_URL" > masir-$(date +%F).sql
```

Then read the **Upgrade notes** for every version between yours and the one you
install, in the [changelog](https://github.com/hamedniroomand/masir/blob/main/CHANGELOG.md)
and in [Version notes](#version-notes) below. Most releases have none. A
release that needs a new variable or takes time on a large table says so there.

## Upgrade

Pin the image to a version, not to `latest`, so an upgrade is a change you make
on purpose.

```sh
git fetch --tags
git checkout v1.2.0
docker compose up -d --build
```

Migrations run on boot under a Postgres advisory lock. A rolling deploy or
`--scale app=3` applies them once, and the other instances wait. The old
instances keep serving against the new schema until they stop, because a
release only adds to the schema.

## Skipping versions

You can jump from any tagged version to the latest one. Migrations are
incremental and never rewritten, so the server applies every step you missed in
order. Read the upgrade notes for the versions you skipped; the migrations do
not read them for you.

## On serverless

With `NUXT_MIGRATE_ON_BOOT=false`, nothing migrates on its own. Run the
migration as a deploy step against the direct connection string, before the new
build takes traffic:

```sh
bun run db:migrate
```

## If it fails

The server refuses to start and names the problem in the first log line. A bad
environment variable is a config error: fix the value and start again. A failed
migration leaves the database at the last completed step: report it with the
log line, and start the previous version again. It runs against the partial
schema, because a migration only adds.

To go back further, restore the backup and start the previous version.

## Version notes

No version has been tagged yet. Each release adds a heading here with the
actions it needs, and only those.
