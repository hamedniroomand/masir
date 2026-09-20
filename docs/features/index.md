# User guide

> Learn the daily workflows for links, teams, and accounts.

Choose the task that matches what you need to do.

## Work with links

<CardGroup :cols="2">

<Card title="Create and manage links" icon="link" to="/features/links">

Create links, change destinations, add aliases, pass query values, make QR
codes, and inspect change history.

</Card>

<Card title="Control link access" icon="shield-check" to="/features/access-control">

Use passwords, schedules, expiry, visit limits, fallback destinations, and
alerts.

</Card>

<Card title="Route visitors" icon="crosshair" to="/features/targeting">

Send visitors to a different destination by country or operating system.

</Card>

<Card title="Measure traffic" icon="chart-line" to="/features/analytics">

Read clicks, unique visitors, referrers, locations, devices, browsers, and
outcomes.

</Card>

<Card title="Organize links" icon="megaphone" to="/features/campaigns">

Use tags for flexible grouping and campaigns for shared UTM values.

</Card>

</CardGroup>

## Work with people

<CardGroup :cols="3">

<Card title="Workspaces" icon="building-2" to="/guide/workspaces">

Understand ownership, addresses, logos, activity, and isolation.

</Card>

<Card title="Members and roles" icon="users" to="/guide/members">

Invite people and assign owner, member, or viewer access.

</Card>

<Card title="Accounts and sign-in" icon="key-round" to="/guide/authentication">

Use passwords, Google, Microsoft, recovery, and connected identities.

</Card>

</CardGroup>

## Product boundaries

Masir is focused on durable shared links.

- The API uses session cookies. API tokens are not available.
- Workspaces use subdomains in multi-workspace mode. Per-workspace custom
  domains are not available.
- Analytics describe link traffic. Masir does not provide funnels, retention,
  or session replay.
- Two-factor authentication and billing are not included.

