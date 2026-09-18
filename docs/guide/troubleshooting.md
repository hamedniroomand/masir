# Troubleshooting

Most problems announce themselves in the first line of the log. Start there.

## The app exits right after starting

Masir validates its configuration at boot and names the variable it is unhappy
about:

```text
Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)
Missing or invalid NUXT_DATABASE_URL (must be a postgres:// connection string)
NUXT_MULTI_WORKSPACE is true, so NUXT_SESSION_COOKIE_DOMAIN must be set
```

This is on purpose. A missing value that fails later, under load, in a way that
looks like something else, costs far more than a refused boot.

## `/api/health` returns 503

The app is running and Postgres is not reachable. Check `NUXT_DATABASE_URL`,
then check that the database accepts connections from the app's network.

```sh
docker compose exec app bun -e "console.log(process.env.NUXT_DATABASE_URL)"
```

## Sign-in works, then every page says not found

The account has no workspace membership. This happens when public registration
is on in single-workspace mode: the person can register, but cannot join your
workspace without an invitation and cannot create a second workspace.

Invite them from **Settings → Members**, or turn registration off:

```sh [.env]
NUXT_ALLOW_REGISTRATION=false
```

## Sign-in loops back to the login page

Three common causes, in order of likelihood.

**Plain HTTP on a host other than localhost.** The session cookie is marked
`Secure` and the browser drops it. Put TLS in front, or on a private network
set `NUXT_SESSION_COOKIE_SECURE=false`.

**Multi-workspace mode on `localhost`.** Browsers ignore `Domain=.localhost`.
Use a dotted hostname such as `lvh.me`. See
[local development](/guide/multi-workspace#local-development).

**The cookie domain is missing its leading dot.** It needs the parent domain
with the dot: `NUXT_SESSION_COOKIE_DOMAIN=.example.com`.

## Switching workspaces asks me to sign in again

Same cause as above. `NUXT_SESSION_COOKIE_DOMAIN` must be the parent domain
with a leading dot:

```sh [.env]
NUXT_SESSION_COOKIE_DOMAIN=.example.com
```

## OAuth returns redirect_uri_mismatch

The URI registered with the provider must match what Masir sends, byte for
byte: protocol, host, port, path, no trailing slash.

The most common cause is browsing to `127.0.0.1` while the registration says
`localhost`. Providers treat those as different origins.

## Country is always empty

Masir reads the country from a proxy header and never geolocates an IP itself.
Without a proxy in front that sets one, there is no country data.

```sh [.env]
NUXT_GEO_COUNTRY_HEADER=cf-ipcountry
```

## "sorry, too many clients already"

Each instance opens up to `NUXT_DATABASE_POOL_MAX` connections, and Postgres
allows 100 in total by default. Multiply your instance count by the pool size.
If it approaches 100, lower the pool.

```sh [.env]
NUXT_DATABASE_POOL_MAX=10
```

On serverless, set it to `1` or `2` and use a pooled connection string.

## Invitation emails never arrive

With no mail provider configured, messages are written to the log instead of
sent. Check the app log. The message is there, including the link. Configure
[SMTP or Resend](/guide/authentication#sending-email) for real delivery.

## Everyone is rate limited at once

`NUXT_TRUSTED_PROXY_DEPTH` is `0` while a proxy sits in front, so every visitor
arrives from the proxy's address and shares one bucket. Set it to the number of
proxies, usually `1`.

## A link answers 404 but it exists

Every blocked state answers 404 on purpose, so a visitor cannot tell a
disabled link from one that never existed. Open the link in the dashboard. The
status badge says whether it is **disabled**, **scheduled**, **expired**, or
at its **visit limit**.

In multi-workspace mode, also check the host. A link resolves only on its own
workspace's subdomain.

## A new link answers 404 on one instance

With several instances, a visitor who reached the address before the link
existed can leave a cached miss on another instance. Misses are held for 15
seconds, so the link starts working everywhere within that window. A single
instance clears the miss the moment the link is created.
