---
layout: home

hero:
  name: Masir
  text: Short links your team owns.
  image:
    src: /icon.svg
    alt: Masir
  tagline: >-
    A self-hosted link manager with workspaces, access control, and analytics
    that never store a visitor's IP address. Share a link once, then change
    where it goes whenever you like.
  actions:
    - theme: brand
      text: Get started
      link: /guide/installation
    - theme: alt
      text: What is Masir?
      link: /guide/
    - theme: alt
      text: GitHub
      link: https://github.com/hamedniroomand/masir
---

```sh
docker compose up -d --build
docker compose exec app bun run db:seed:admin
```

## Why teams pick Masir

<CardGroup :cols="2">

<Card title="The link outlives the destination" icon="link">

Print `go.acme.com/pricing` on a poster. Point it somewhere new next year.
Every slide, email, and QR code you already sent keeps working.

</Card>

<Card title="Links belong to the team" icon="building-2">

A workspace owns its links. When someone leaves, you remove the person and
keep the links. One owner, any number of members and read-only viewers, and the
database itself refuses a second owner.

</Card>

<Card title="Analytics you can show a lawyer" icon="chart-line">

Clicks, unique visitors, referrers, countries, devices, and browsers. No IP
addresses, no user agents, no third party in the request path. Bots are counted
on their own row.

</Card>

<Card title="Links that lock, wait, and expire" icon="shield-check">

Put a password on a link, hold it until a launch date, retire it after an
event, or cap it at a number of visits. A one-time link is a cap of one.

</Card>

</CardGroup>

## One codebase, two shapes

**Single workspace.** One team, your own domain, nothing else to set up. This
is the default.

**Multi-workspace.** Every workspace gets its own subdomain behind one wildcard
DNS record and one wildcard certificate. Creating a workspace is a database
insert. No DNS API, no certificate automation.

The schema is the same in both. One environment variable picks the shape.

<ReadMore to="/guide/installation" title="Install Masir in five minutes" />
