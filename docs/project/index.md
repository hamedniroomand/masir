# Project

How Masir is put together, the choices behind it, and how to work on it.

<CardGroup :cols="2">

<Card title="Architecture" icon="network" to="/project/architecture">

The redirect path, where state lives, and what the cache does.

</Card>

<Card title="Security" icon="lock" to="/project/security">

Tenancy, sessions, passwords, destination validation, and what is not covered.

</Card>

<Card title="Development" icon="hammer" to="/project/development">

Set up, run the tests, and find your way around the code.

</Card>

<Card title="Compatibility" icon="shield-check" to="/project/compatibility">

Versioning, migrations, configuration, and what an upgrade must never break.

</Card>

</CardGroup>

## Principles

**Bun's own APIs first.** Passwords go through `Bun.password`, digests through
`Bun.CryptoHasher`, uploads through Bun's S3 client, Postgres through Bun's
native `SQL`. Resend is reached over `fetch`. `nodemailer` loads only when SMTP
is the chosen transport. Each of these replaced a dependency that would
otherwise ship in every deployment. The one exception is QR codes, which
compress with `node:zlib` because a PNG needs zlib-framed deflate.

**The database enforces what matters.** Slug uniqueness, single ownership, and
tenancy are constraints, not checks in application code. A check has a race. A
unique index does not.

**Fail at boot, not under load.** Configuration is validated when the process
starts. A missing session password stops the container instead of producing a
confusing failure at three in the morning.

**Store less.** No visitor IP addresses, no user agent strings, no third-party
analytics in the request path. Data that is never written cannot leak.

**One registry per pluggable thing.** Mail and storage both resolve a named
provider at boot, fall through to the next configured one, and log which they
picked. Adding a transport is a file, not a branch in a resolver.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun 1.4 |
| Framework | Nuxt 4 with the Nitro server |
| Interface | Vue 3, Nuxt UI 4, Tailwind 4 |
| Database | Postgres 18 or newer, Drizzle ORM |
| Sessions | `nuxt-auth-utils`, sealed cookies |
| Tests | Vitest, `@nuxt/test-utils`, Playwright |
| Docs | VitePress |

## License

MIT. See [LICENSE](https://github.com/hamedniroomand/masir/blob/main/LICENSE).
