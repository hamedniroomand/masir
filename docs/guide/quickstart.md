# Create your first link

> Publish a short link, change its destination, and confirm that analytics work.

This guide assumes that Masir is running and the first owner account exists.

## Create the link

1. Open `/login` and sign in.
2. Select **New link**.
3. Enter a destination such as `https://example.com/docs`.
4. Enter `docs` as the slug, or leave it empty to generate one.
5. Select **Create link**.

Masir shows the full short URL. The public address uses
`NUXT_PUBLIC_SHORT_DOMAIN` and the workspace link prefix, when one is set.

## Verify the redirect

Open the short URL in a new browser tab, or inspect it from a terminal:

```sh
curl -I https://go.example.com/docs
```

The response is `302` and the `Location` header contains the destination.

## Change the destination

Open the link, replace its destination, and save. Open the same short URL
again. It now sends the visitor to the new destination.

The public link did not change. This is the main reason to put Masir between a
shared address and its current destination.

## Check the traffic

Open the link analytics panel. It shows requests by time, outcome, referrer,
country, device, browser, and bot class.

Masir uses a daily salted hash to count unique visitors. It does not store the
source IP address or user-agent string.

## Check the change history

Open the history panel for the link. It shows the recent changes, the user who
made each change, and the fields that changed.

Workspace owners can also open the workspace activity log for link, campaign,
member, and security events.

## Optional: use the HTTP API

Sign in and save the session cookie:

```sh
curl -sS -X POST https://go.example.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}' \
  -c cookie.txt
```

Create another link:

```sh
curl -sS -X POST https://go.example.com/api/links \
  -H 'content-type: application/json' \
  -b cookie.txt \
  -d '{"destinationUrl":"https://example.com","slug":"example"}'
```

Masir does not have API tokens yet. The API uses the same session cookie as
the interface.

## Next steps

<CardGroup :cols="2">

<Card title="Manage links" icon="link" to="/features/links">

Learn aliases, query passthrough, QR codes, notes, and deletion.

</Card>

<Card title="Prepare production" icon="server" to="/guide/self-hosting">

Configure domains, email, storage, backups, and monitoring.

</Card>

</CardGroup>

