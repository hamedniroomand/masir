# Upgrade Masir

> Back up the state, read each release note, and verify the new instance before you finish.

Masir applies forward-only database migrations. A downgrade does not reverse
them. A tested backup is the rollback path.

## Before an upgrade

1. Read every changelog entry between the current and target versions.
2. Read each **Upgrade notes** block.
3. Back up Postgres.
4. Back up the uploads volume when you use file storage.
5. Record the current image version and environment.
6. Test the target release on a restored copy when the data matters.

## Upgrade the published image

Pin the target release in `.env`:

```sh
MASIR_VERSION=1.1.0
```

Pull and restart:

```sh
docker compose -f compose.image.yaml pull
docker compose -f compose.image.yaml up -d
```

Watch the application log while migrations run:

```sh
docker compose -f compose.image.yaml logs -f app
```

## Upgrade a local build

Update the repository, rebuild, and restart:

```sh
git pull --ff-only
docker compose up -d --build
```

Do not edit a migration that another deployment can already have applied.

## Verify the result

Check:

```sh
curl -fsS https://go.example.com/api/health
```

Then sign in, open a known link, create a temporary link, and confirm that
analytics record its request.

## Skip versions

You can skip releases. Read and apply the notes for every skipped version in
order. Database migrations run in order and use an advisory lock.

## Upgrade on serverless

Set `NUXT_MIGRATE_ON_BOOT=false`. Run the migration command once during
deployment against the direct Postgres connection:

```sh
bun run db:migrate
```

Do not let every cold start attempt the migration.

## Roll back

Restore the database backup and uploads from the same point in time, then run
the previous image. Do not point an older release at a schema that its
compatibility range does not support.

<ReadMore to="/project/compatibility" title="Read the compatibility policy" />

