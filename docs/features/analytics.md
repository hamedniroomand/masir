# Analytics

Enough to answer "is this working?" without building a tracking company.

## What you get

Open a link and the **Overview** tab shows:

- **Total clicks**, the number of successful human redirects over the link's
  lifetime.
- **Unique visitors** in the selected period, counted with a rotating hash.
- **Bot requests** in the period.
- **Remaining visits**, when the link has a cap.
- A **timeline** of clicks, hourly for a day and daily beyond that.
- Breakdowns by **referrer**, **country**, **device**, **browser**, and
  **outcome**.

Pick a period of 24 hours, 7 days, 30 days, or all time. Switch the traffic
filter between **human** (the default), **bots**, or **all**.

Campaigns have the same view across all their links, grouped by `utm_source`.

## What is never stored

No IP addresses. No user agent strings. No cookies on the visitor. No full
referrer URL, only its host.

This is a design choice, not a gap. An analytics table without IP addresses is
one you can keep, export, and show to anyone without a story.

## How unique visitors work

Each click computes a hash of the secret, the day number, the link id, the
visitor's IP, and their user agent. The first eight bytes of the digest are
stored as a 64-bit integer. The column is only ever counted, never compared to
anything outside the database.

The day number is in the hash, so the same person counts once per day for each
link and the hash rotates at midnight UTC. Yesterday's hashes cannot be matched
to today's.

The secret is in the hash because the IP address space is small enough to
search. Without it, anyone holding the table could try every address against a
hash and recover the visitor. `NUXT_VISITOR_HASH_SECRET` sets it. If you leave
it empty the session password is used, which means rotating the session
password also resets visitor counts for the day.

::: info Shared connections merge
People behind one NAT gateway with the same browser count as one visitor. The
alternative is storing something that identifies them individually, which is
the thing this design refuses to do.
:::

## Outcomes

Every request records why it ended the way it did:

| Outcome | Meaning |
|---|---|
| `redirect_success` | Reached the destination |
| `bot_request` | Classified as a bot |
| `password_failed` | Wrong password |
| `scheduled_block` | Before the start date |
| `disabled_block` | Link switched off |
| `expired_block` | Past expiry, no fallback |
| `expired_redirect` | Past expiry, sent to the fallback |
| `limit_reached` | Visit cap used up |

This turns "the link is broken" into an answer. If `password_failed` dominates,
people do not have the password. If `bot_request` dominates, the number you
were proud of was Slack unfurling the URL.

## Bots

Requests are classified from the user agent into four categories: `search`,
`social_preview`, `monitoring`, and `automation`. Bots still get the redirect,
so link previews work, but the event is stored with the bot flag set.

Bot traffic is recorded, not discarded, and left out of the default view. It
never adds to the click count and never uses up a visit. Switch the traffic
filter to see it.

## Countries

Read from a header your proxy sets. Cloudflare's `cf-ipcountry` and Vercel's
`x-vercel-ip-country` are recognised without configuration. For anything else,
name the header:

```sh [.env]
NUXT_GEO_COUNTRY_HEADER=x-geo-country
```

With no proxy in front, the country breakdown stays empty. Masir does not
geolocate an IP itself, because that would mean handling the address it has
chosen not to store.

## Recorded after the response

The redirect is sent first. The click is written in the background.

A visitor never waits on an analytics insert, and a database that is slow or
briefly unavailable delays nothing. The redirect still lands.

## Exporting

Every breakdown is available over the [HTTP API](/reference/api) with the same
filters as the interface. That is how you get the data into a spreadsheet or a
warehouse.
