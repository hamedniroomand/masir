# Your first link

This page walks through the core loop once: create a link, change where it
points, and look at the clicks. It assumes you have
[installed Masir](/guide/installation) and can sign in.

## Create a link

Sign in and press **New link**. The only required field is the destination.

Leave the slug empty and Masir generates a seven-character one. The alphabet
skips `0`, `1`, `i`, `l`, and `o`, so nobody misreads it from a slide or a
printed page. Or type your own slug for something memorable.

```text
Destination   https://acme.example.com/pricing/2026-enterprise
Slug          pricing
```

You now have `https://go.example.com/pricing`. Open it in a new tab and you
land on the destination.

## Change where it points

Open the link, switch to **Settings**, and edit the destination. Save.

The short URL is unchanged, so everything you already shared keeps working and
now lands somewhere new. This is the whole reason to use a shortener, and it is
worth trying once to see it happen.

::: info Why a 302 and not a 301
Masir answers with a temporary redirect. Browsers cache a permanent redirect
for a long time, and you would lose the ability to move anyone who had already
clicked.
:::

## Watch the clicks

The **Overview** tab shows total clicks, unique visitors, a timeline, and
breakdowns by referrer, country, device, browser, and outcome. Pick a period of
24 hours, 7 days, 30 days, or all time.

Two things are worth knowing from the start:

- **Bots are counted separately.** A link posted to Slack collects a preview
  fetch for every channel it lands in. Those show up under bot traffic, never
  in your click count.
- **Unique visitors rotate daily.** The same person visiting on Monday and
  Tuesday counts twice. That is the trade for storing no IP addresses at all.

<ReadMore to="/features/analytics" title="How the numbers are calculated" />

## See who changed what

The **History** tab lists every change to the link, who made it, and which
fields moved. Useful when a destination changes and nobody remembers doing it.

## Try the API

Everything the interface does is a normal HTTP endpoint that uses the same
session cookie.

```sh
# Sign in and keep the cookie
curl -s -X POST https://go.example.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' \
  -c cookie.txt

# Create a link
curl -s -X POST https://go.example.com/api/links \
  -H 'content-type: application/json' -b cookie.txt \
  -d '{"destinationUrl":"https://example.com/target","slug":"hello"}'
```

```json
{
  "id": "7bcb3afe-f0a2-4c42-a35b-5c81032f2c43",
  "slug": "hello",
  "shortUrl": "https://go.example.com/hello",
  "status": "active"
}
```

<ReadMore to="/reference/api" title="Every API route" />

## Next steps

<CardGroup :cols="2">

<Card title="Access control" icon="shield-check" to="/features/access-control">

Passwords, schedules, expiry, and visit caps.

</Card>

<Card title="Invite your team" icon="users" to="/guide/members">

Roles, invitations, and what a member can do.

</Card>

</CardGroup>
