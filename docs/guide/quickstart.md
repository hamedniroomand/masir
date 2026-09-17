# Your first link

This walks through the flow once, end to end. It assumes you have
[installed](/guide/installation) Masir and can sign in.

## Create a link

Sign in and press **New link**. The only field you must fill is the
destination.

Leave the slug blank and Masir generates a seven-character one from an
alphabet that avoids `0`, `1`, `l`, and `o`, so nobody mistypes it reading off a
slide. Type your own slug if you want something memorable.

```text
Destination   https://acme.example.com/pricing/2026-enterprise
Slug          pricing
```

You now have `https://go.example.com/pricing`.

## Change where it points

Open the link and edit the destination. Save.

The short URL does not change, so everything you already shared keeps working
and now lands somewhere new. This is the reason to use a shortener at all, and
it is worth trying once to convince yourself it works.

::: info Why 302 and not 301
Masir answers with a temporary redirect. A permanent redirect gets cached by
browsers for a long time, and you would lose the ability to edit the
destination for anyone who had already clicked.
:::

## Watch the clicks

Open the link and switch to **Analytics**. You will see total clicks, unique
visitors, referrers, countries, devices, and browsers, with a period selector.

Two things are worth knowing straight away. Bot traffic is counted separately
and never inflates your click count. And unique visitors come from a hash that
rotates every day, so the same person visiting on Monday and Tuesday counts
twice — that is the trade for storing no IP addresses at all.

<ReadMore to="/features/analytics" title="How the numbers are calculated" />

## Try the API

Everything the interface does is a normal HTTP endpoint on the same session
cookie.

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

## Next steps

<CardGroup :cols="2">

<Card title="Access control" icon="shield-check" to="/features/access-control">

Passwords, expiry dates, schedules, and visit caps.

</Card>

<Card title="Invite your team" icon="users" to="/guide/members">

Roles, invitations, and what a member can do.

</Card>

</CardGroup>
