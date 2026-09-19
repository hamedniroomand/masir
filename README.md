<p align="center">
  <img src="docs/public/icon.svg" width="72" alt="Masir">
</p>

<h1 align="center">Masir</h1>

<p align="center">
  Short links your team owns. Self-hosted, with workspaces, access control, and privacy-friendly analytics.
</p>

<p align="center">
  <a href="https://hamedniroomand.github.io/masir/">Documentation</a> ·
  <a href="https://hamedniroomand.github.io/masir/guide/installation">Install</a> ·
  <a href="https://hamedniroomand.github.io/masir/reference/environment">Configuration</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

Masir turns long URLs into short ones on your own domain, and keeps them under your control after you have shared them. Change where a link points, put a password in front of it, let it expire, or cap how many times it can be opened. Every click is counted without storing a single IP address.

## Highlights

- **Editable destinations.** The short URL never changes. Where it goes can.
- **Workspaces and roles.** Links belong to a team, not to a person. One owner, any number of members, and read-only viewers.
- **Access control.** Passwords, start dates, expiry dates, visit caps, and one-time links. Each blocked state can send visitors to a fallback page instead of a 404.
- **Targeting.** One link, a different destination for iOS, Android, desktop, or a country.
- **Rename without breaking.** Change a short address and keep the old one working. A link can hold several addresses, and an address that once worked is never handed to another link.
- **Analytics without tracking.** Clicks, unique visitors, referrers, countries, devices, and browsers. Bots are counted separately. No IP addresses, no user agents, no cookies on visitors.
- **Tags and campaigns.** Group links and share UTM values across a campaign.
- **Alerts before a link stops.** Email the owner before a link reaches its visit cap or expires.
- **One instance, one team or many.** Run a single workspace on your domain, or give every workspace its own subdomain.
- **Sign in your way.** Email and password, Google, or Microsoft.

## Quick start

You need Docker and a machine that can run it. Postgres comes with the stack.

```sh
git clone https://github.com/hamedniroomand/masir.git
cd masir
cp .env.example .env
```

Open `.env` and set `POSTGRES_PASSWORD`, `NUXT_SESSION_PASSWORD` (32 or more characters), and `NUXT_ROOT_DOMAIN`. Then:

```sh
docker compose up -d --build
docker compose exec app bun run db:seed:admin
```

Sign in at `/login` with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`.

The [installation guide](https://hamedniroomand.github.io/masir/guide/installation) covers running from source, Vercel, and multi-workspace mode.

## Documentation

Everything lives at **[hamedniroomand.github.io/masir](https://hamedniroomand.github.io/masir/)**.

- [Guide](https://hamedniroomand.github.io/masir/guide/) covers installation, workspaces, sign-in, and deployment.
- [Features](https://hamedniroomand.github.io/masir/features/) explains links, access control, targeting, analytics, and campaigns.
- [Reference](https://hamedniroomand.github.io/masir/reference/) lists every environment variable, script, and API route.
- [Project](https://hamedniroomand.github.io/masir/project/) describes the architecture, security model, and how to contribute.

## Built with

Bun, Nuxt 4, Vue 3, Nuxt UI, Postgres 18, and Drizzle ORM.

## License

[MIT](LICENSE)
