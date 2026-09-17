---
layout: home

hero:
  name: Masir
  text: Short links your team actually owns.
  tagline: >-
    Self-hosted link management with workspaces, real access control, and
    analytics that never store a visitor's IP address. Change where a link
    points long after you have shared it.
  actions:
    - theme: brand
      text: Get started
      link: /guide/installation
    - theme: alt
      text: Why Masir
      link: /guide/
---

```sh
docker compose up -d
docker compose exec app bun run db:seed:admin
```

## Built for teams that share links

<CardGroup :cols="2">

<Card title="The destination is not the URL" icon="link">

Share `go.acme.com/pricing` once. Point it somewhere new next quarter. Every
deck, email, and QR code you already sent keeps working, because the short link
never changed.

</Card>

<Card title="Workspaces, not accounts" icon="building-2">

Links belong to a workspace, not to whoever created them. People come and go;
the links stay. One owner holds the keys, and the database itself refuses a
second one.

</Card>

<Card title="Analytics without surveillance" icon="chart-line">

No IP address ever reaches the database. Unique visitors come from a hash that
rotates daily, bots are classified and excluded, and there is no third party in
the request path.

</Card>

<Card title="Links that expire, lock, and count" icon="shield-check">

Set a password, a start date, an expiry, or a hard visit cap. A one-time link
is a cap of one. Expired links can redirect somewhere else instead of dying.

</Card>

</CardGroup>

## Run it your way

Masir ships one codebase in two shapes.

**Self-hosted** holds a single workspace on your own domain. No wildcard DNS, no
certificates beyond the one you already have, no subdomain to think about.

**Multi-workspace** gives every workspace its own subdomain — `acme.example.com`,
`apple.example.com` — behind one wildcard record. Creating a workspace is a
database insert and nothing else. No DNS API, no certificate provisioning.

The schema is identical in both. One environment variable decides.

<ReadMore to="/guide/self-hosting" title="Set up your own instance" />
