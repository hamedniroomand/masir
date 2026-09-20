# Contributing

> Understand the project, choose a focused change, and verify it before review.

Masir is an MIT-licensed Bun and Nuxt application. Contributions can improve
the product, deployment experience, tests, or documentation.

## Start here

<CardGroup :cols="2">

<Card title="Development workflow" icon="hammer" to="/project/development">

Install dependencies, start services, run tests, and prepare a pull request.

</Card>

<Card title="Architecture" icon="network" to="/project/architecture">

Follow a request through host resolution, redirect rules, storage, and event
recording.

</Card>

<Card title="Security model" icon="lock" to="/project/security">

Review tenant isolation, sessions, passwords, validation, and rate limits.

</Card>

<Card title="Compatibility policy" icon="shield-check" to="/project/compatibility">

Protect existing deployments, data, routes, and configuration.

</Card>

</CardGroup>

## Project principles

- Use the platform or standard library before adding a dependency.
- Put tenant scope in repository operations, not only in handlers.
- Use database constraints for invariants that can race.
- Validate deployment configuration before the server accepts traffic.
- Store less visitor data.
- Keep migrations forward-only and compatible with rolling deployment.
- Prefer the smallest change that fixes the shared cause.

## Stack

| Area | Technology |
|---|---|
| Runtime | Bun 1.4 |
| Application | Nuxt 4 and Nitro |
| Interface | Vue 3, Nuxt UI 4, Tailwind CSS 4 |
| Database | Postgres 18 and Drizzle ORM |
| Sessions | `nuxt-auth-utils` sealed cookies |
| Tests | Vitest, Nuxt test utilities, Playwright |
| Documentation | VitePress 2 |
| License | MIT |

## Choose an issue

Keep one pull request focused. Read the affected flow from the interface or
route through its shared utility and database operation. Add the smallest test
that proves the behavior.

For a security problem, use a private GitHub security advisory instead of a
public issue.

