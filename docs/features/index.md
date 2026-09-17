# Features

What Masir does, in one page.

<CardGroup :cols="2">

<Card title="Short links" icon="link" to="/features/links">

Custom or generated slugs, editable destinations, QR codes, and query
passthrough.

</Card>

<Card title="Access control" icon="shield-check" to="/features/access-control">

Passwords, schedules, expiry, visit caps, and one-time links.

</Card>

<Card title="Analytics" icon="chart-line" to="/features/analytics">

Clicks, unique visitors, referrers, countries, devices — with bots separated
and no IP addresses stored.

</Card>

<Card title="Tags and campaigns" icon="megaphone" to="/features/campaigns">

Group links, filter by tag, and share UTM values across a campaign.

</Card>

</CardGroup>

## Not included

Worth stating plainly so you can judge the fit.

**No billing or usage limits.** The schema carries plan and trial columns so
they can be added without a redesign, but nothing enforces them today.

**No custom domains per workspace.** A workspace lives on its subdomain. The
data model has room for `domains` later; the feature is not built.

**No API tokens.** The HTTP API is real and complete, but it authenticates with
the same session cookie the interface uses. There is no separate token yet.

**No deep analytics.** Clicks, visitors, referrers, countries, devices,
browsers. No funnels, no sessions, no retention. UTM parameters pass straight
through to whatever analytics tool you already run.
