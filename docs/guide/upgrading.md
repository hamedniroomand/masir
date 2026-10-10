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

Pin the target release in `.env`. Use the version number from the
[releases page](https://github.com/hamedniroomand/masir/releases), without the `v`:

```sh
MASIR_VERSION=x.y.z
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

## 1.x to 2.0

Masir 2.0 serves one workspace, signs users in with a password only, and runs
on Bun on a server only.

1. Back up the database. The 2.0 migration deletes data. Masir has no down
   migrations.
2. Keep one workspace on 1.x and delete the others. The migration stops when
   more than one live workspace exists. Stay on 1.x if you need several
   workspaces. A demo workspace counts as live until 1.x deletes it, so delete
   demo workspaces before the upgrade.
3. Stop every instance. 1.x code does not work against the 2.0 schema, so a
   rolling deploy does not work for this release.
4. Upgrade and start the new version.
5. Delete the removed variables from `.env`. The app ignores them.

The migration permanently deletes:

- soft-deleted workspaces with their links
- Google and Microsoft sign-in records
- email verification tokens

A user who signed in only with Google or Microsoft uses **Forgot password** to
set a password.

The migration also drops the workspace plan, trial, subscription, demo expiry,
and deletion columns. It drops the user email verification and avatar columns.

Short links on workspace subdomains stop working. Short links on
`NUXT_PUBLIC_SHORT_DOMAIN` keep working.

The `/no-access` page is new, so `no-access` is now a reserved slug. A short
link or link prefix named `no-access` stops working. Rename it before the
upgrade.

The `x-vercel-ip-country` fallback is gone. Set `NUXT_GEO_COUNTRY_HEADER` if
your proxy sends the country in another header.

Masir 2.0 removes these variables: `NUXT_DEMO_ENABLED`,
`NUXT_ALLOW_REGISTRATION`, `NUXT_PUBLIC_TURNSTILE_SITE_KEY`,
`NUXT_TURNSTILE_SECRET_KEY`, `NUXT_DEPLOYMENT_MODE`, `NUXT_MULTI_WORKSPACE`,
`NUXT_APP_DOMAIN`, `NUXT_SESSION_COOKIE_DOMAIN`,
`NUXT_RATE_LIMIT_WORKSPACE_PER_DAY`, `NUXT_RATE_LIMIT_SLUG_CHECK_PER_MINUTE`, the five `NUXT_OAUTH_*` variables, and
`NUXT_SERVERLESS`.

## Roll back

Restore the database backup and uploads from the same point in time, then run
the previous image. Do not point an older release at a schema that its
compatibility range does not support.

<ReadMore to="/project/compatibility" title="Read the compatibility policy" />

