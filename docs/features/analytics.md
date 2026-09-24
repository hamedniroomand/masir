# Measure link traffic

> Understand how a link performs without storing raw visitor identities.

Every request creates an event after Masir sends the response. Analytics work
does not delay the redirect.

## Read the summary

Link analytics include:

- total requests
- successful human visits
- daily unique visitors
- a time series
- referrer hosts
- countries
- devices
- browsers
- outcomes
- bot categories

Use the period filter for 24 hours, 7 days, 30 days, or all retained data. Use
a custom UTC date range when you need exact boundaries. The end date is
exclusive. Turn on compare previous to see absolute and percent change against
the equal-length range that ends at the start. When the previous range has no
clicks, the report shows "No prior data". Use the traffic filter for humans,
bots, or both.

Workspace and campaign views aggregate the same event data at a broader level.

## Response fields

The HTTP route `GET /api/links/:id/analytics` returns:

- `periodClicks`: redirects in the selected period
- `lifetimeClicks`: all-time successful redirects on the link (equals `totalClicks`)
- `usedVisits`: visits counted toward the limit (equals `successfulVisitCount`)
- `remainingVisits`: visits remaining before the limit takes effect
- `maximumVisits`: configured visit limit
- `uniqueVisitors`: daily unique visitors in the period
- `botRequests`: crawler and preview requests in the period
- `meta`: for a period request, `{ timezone: 'UTC', period, traffic }`. For a
  custom range, `{ timezone: 'UTC', from, to, traffic, earliestEventAt, signals,
  warning? }`
- `previous` / `change`: present when `compare=previous`

## Understand unique visitors

Masir creates a salted hash from the link, client address, user agent, and
current day. It stores the first eight bytes as a number.

The same person counts once per link each day. The value changes the next day
and cannot join activity across days.

Set `NUXT_VISITOR_HASH_SECRET` so a session-secret rotation does not reset the
current daily counts.

## Know what is stored

A click event can store the link and workspace IDs, time, outcome, visitor
hash, referrer host, country, device, browser, and bot class.

Masir does not store:

- the visitor IP address
- the full user-agent string
- a visitor cookie
- a cross-link visitor identity
- a third-party analytics request in the redirect path

## Read outcomes

An outcome explains what happened before a redirect:

- success
- password required or rejected
- scheduled
- expired
- visit limit reached
- disabled
- destination or request failure

Successful human redirects increase the visit counter. Other outcomes do not.

## Understand bots

Masir classifies common crawlers and preview agents. Bot traffic appears
separately and does not consume a visit limit. Bots use the default
destination instead of a targeting rule.

## Retention and export

Click events use monthly Postgres partitions. The application creates the
current and next partitions at boot.

Masir has no export button. Query Postgres or use the HTTP analytics routes
when you need data outside the interface.

<ReadMore to="/reference/data-model#click-events" title="Read the event data model" />

