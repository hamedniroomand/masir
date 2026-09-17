# Analytics

Enough to answer "is this working", without building a tracking company.

## What you get

**Clicks** — every request that reached the link, including blocked ones.

**Unique visitors** — distinct visitors, counted by a rotating hash.

**Referrers** — the host that sent them, not the full URL. The host name is
stored once in a `hosts` table, and each event row holds its integer id.

**Countries** — from a proxy header, when your proxy sets one.

**Devices and browsers** — desktop, mobile, tablet, other; browser by family.

**Outcomes** — why a request ended the way it did.

Every breakdown accepts a date range and a bots filter.

## What is never stored

No IP addresses. No user agent strings. No cookies on the visitor. No full
referrer URL, only its host.

This is not an oversight to be fixed later. An analytics table without IP
addresses is one you can keep, export, and hand to a lawyer without a story.

## How unique visitors work

The visitor hash is `sha256(secret:day:linkId:ip:userAgent)`. The first eight
bytes of the digest are stored as a 64 bit integer. The column is only ever
counted, never compared to anything outside the database, and `count(distinct)`
over an integer is much faster than over text.

The day number is in the salt, so the same person counts once per day for each
link and the hash rotates at midnight UTC. Yesterday's hashes cannot be matched
to today's.

The secret is in the salt because the IP address space is small enough to
search. Without it, anyone holding the table could try every address against a
hash and recover the visitor.

::: info
People behind one NAT gateway with the same browser merge into one visitor. The
alternative is storing something that identifies them individually, which is the
thing this design refuses to do.
:::

## Outcomes

Every request records why it ended:

| Outcome | Meaning |
|---|---|
| `redirect_success` | Reached the destination |
| `bot_request` | Classified as a bot |
| `password_failed` | Wrong password |
| `scheduled_block` | Before the start time |
| `disabled_block` | Link switched off |
| `expired_block` | Past expiry, no fallback |
| `expired_redirect` | Past expiry, sent to the fallback |
| `limit_reached` | Visit cap used up |

This turns "the link is broken" into an answer. If `password_failed` dominates,
people do not have the password. If `bot_request` dominates, the number you
were proud of was Slack unfurling the URL.

## Bots

Requests are classified from the user agent into four categories — `search`,
`social_preview`, `monitoring`, `automation` — and stored with the flag set.

They are recorded, not discarded, and excluded from the default view. A link
posted to Slack collects a preview fetch for every channel it lands in. Counting
those as clicks makes a launch look twice as successful as it was.

Turn bots on in the filter when you want to see crawler traffic.

## Countries

Read from a header your proxy sets. Cloudflare's `cf-ipcountry` and Vercel's
`x-vercel-ip-country` are recognised without configuration; for anything else,
name the header:

```sh [.env]
NUXT_GEO_COUNTRY_HEADER=x-geo-country
```

With no proxy in front, the country breakdown stays empty. Masir does not
geolocate an IP itself, because that would mean handling the address it has
chosen not to store.

## Writes happen after the response

The redirect is sent first. The click is recorded in the background, through
`event.waitUntil`.

A visitor never waits on an analytics insert, and a database that is slow or
briefly down delays nothing — the redirect still lands.

## How a click is stored

Two statements and no transaction. One guarded update raises the link counter
inside the visit limit, and one insert writes the event.

The event row holds small integers, not words: the outcome, the device, the
browser, and the bot category are codes from `shared/codes.ts`. The API turns
them back into labels before they leave the server, so a caller never sees a
number. A row measures under 100 bytes.

`click_events` is partitioned by month. Boot makes the partition for the current
month and the next one. Dropping an old month is one `drop table`.

## Export

Every breakdown is available over the HTTP API with the same filters as the
interface, which is how you get the data into a spreadsheet or a warehouse.
