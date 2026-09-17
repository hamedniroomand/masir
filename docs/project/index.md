# Project

How Linkyard is put together, and how to work on it.

<CardGroup :cols="3">

<Card title="Architecture" icon="network" to="/project/architecture">

The request path, where state lives, and what the cache does.

</Card>

<Card title="Security" icon="lock" to="/project/security">

Tenancy, sessions, destination validation, and what is not covered.

</Card>

<Card title="Development" icon="hammer" to="/project/development">

Set up, run the tests, and understand the layout.

</Card>

</CardGroup>

## Principles

**Bun's own API first.** Passwords go through `Bun.password`, digests through
`Bun.CryptoHasher`, uploads through Bun's S3 client, Postgres through Bun's
native `SQL`. Resend is reached over `fetch`. `nodemailer` loads only when SMTP
is the chosen transport. Each of those replaced a dependency that would
otherwise sit in every deployment.

One exception is marked as such: QR codes compress with `node:zlib`, because a
PNG needs zlib-framed deflate and `Bun.deflateSync` emits raw deflate.

**The database enforces what matters.** Slug uniqueness, single ownership, and
tenancy are constraints, not checks in application code. A check has a race; a
unique index does not.

**Fail at boot, not under load.** Configuration is validated when the process
starts. A missing session password stops the container rather than producing a
subtle failure at 3am.

**Store less.** No visitor IP addresses, no user agent strings, no third-party
analytics. The data that is never written cannot leak.

**One registry for each pluggable thing.** Mail and storage both resolve a named
provider at boot, fall through to the next configured one, and report which they
picked. Adding a transport is a file, not a branch in a resolver.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun 1.4 |
| Framework | Nuxt 4, Nitro server |
| Interface | Vue 3, Nuxt UI 4, Tailwind 4 |
| Database | Postgres 17+, Drizzle ORM |
| Sessions | `nuxt-auth-utils`, sealed cookies |
| Tests | Vitest, `@nuxt/test-utils` |

## Licence

MIT.
