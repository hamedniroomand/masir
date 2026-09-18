# Features

What Masir does, on one page. Each section links to the details.

<CardGroup :cols="2">

<Card title="Short links" icon="link" to="/features/links">

Custom or generated slugs, editable destinations, QR codes, query passthrough,
and a change history.

</Card>

<Card title="Access control" icon="shield-check" to="/features/access-control">

Passwords, start dates, expiry, visit caps, and one-time links.

</Card>

<Card title="Analytics" icon="chart-line" to="/features/analytics">

Clicks, unique visitors, referrers, countries, devices, and browsers. Bots
separated. No IP addresses stored.

</Card>

<Card title="Tags and campaigns" icon="megaphone" to="/features/campaigns">

Group links, filter by tag, and share UTM values across a campaign.

</Card>

</CardGroup>

## Also included

- **Workspaces with roles.** One owner, any number of members. See
  [Workspaces](/guide/workspaces) and [Members](/guide/members).
- **Email, Google, and Microsoft sign-in.** See [Signing in](/guide/authentication).
- **An HTTP API** for everything the interface does. See [API](/reference/api).
- **An abuse report form** at `/report`, so visitors can flag a link without an
  account.
- **Optional Sentry and Google Analytics** for the application itself, both off
  until you set a key.

## Not included

Worth stating plainly so you can judge the fit.

**No billing or usage limits.** The schema carries plan columns so they can be
added later without a redesign. Nothing enforces them today, and every
workspace is on the `active` plan.

**No custom domains per workspace.** A workspace lives on its subdomain. The
data model has room for it. The feature is not built.

**No API tokens.** The HTTP API is real and complete, but it authenticates with
the same session cookie as the interface. There is no separate token yet.

**No two-factor authentication.**

**No deep analytics.** Clicks, visitors, referrers, countries, devices,
browsers. No funnels, no sessions, no retention. UTM parameters pass straight
through to whatever analytics tool you already run.
