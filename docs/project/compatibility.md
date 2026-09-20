# Compatibility policy

> Compatible upgrades preserve the public behavior that operators and users depend on.

Masir uses semantic versioning. The changelog is the release contract.

## Version meaning

- A **patch** release fixes behavior without requiring operator action.
- A **minor** release can add compatible features, fields, routes, variables,
  and migrations.
- A **major** release can remove or change a public contract after notice.

A release with an operator action includes an **Upgrade notes** block.

## Database changes

Migrations are forward-only and additive during a minor release.

- Never edit a migration that has shipped.
- Add nullable columns or columns with a database default.
- Add tables, indexes, constraints, and enum values safely.
- Keep old application code working against the new schema during a rolling
  deployment.
- Delay removal until a major release after at least one minor release of
  notice.

The migration runner uses a Postgres advisory lock. Several instances can
start together without applying the same migration twice.

Restore a backup to roll back a migrated database. Masir does not ship
untested down migrations.

## Configuration changes

Every new environment variable must:

- have a safe default
- appear in `.env.example`
- appear in the environment reference
- work when an operator does not set it

Do not rename or remove a variable in a minor release. Do not change its
default in a way that changes an existing deployment without notice.

## Stable user behavior

A compatible release preserves:

- link and workspace slugs
- public application and API routes
- response fields
- session behavior
- stored password and token hashes
- upload storage keys
- previously valid destinations and short links

Add a field instead of changing the meaning of an existing field.

## Risky behavior

Use a default-off setting when a new behavior can change routing, access,
storage, or data disclosure. Document the setting and its migration path.

## Changelog rules

Every pull request that changes a migration, environment variable, route, or
user-visible behavior adds an entry under **Unreleased**.

The entry states what changed and what an operator must do. It does not repeat
the commit message.

## Release checks

Before a release:

1. run lint, type checks, unit tests, server tests, browser tests, and docs build
2. inspect generated migrations
3. verify a new install
4. verify an upgrade from the previous minor release
5. verify rolling deployment compatibility
6. review environment and API references
7. add upgrade notes when action is required
8. tag only after all release checks pass

## Limits of the promise

Masir does not promise compatibility for undocumented internal modules,
development-only data, or unreleased migrations. The database and HTTP
contracts described in the published docs are the supported surface.

