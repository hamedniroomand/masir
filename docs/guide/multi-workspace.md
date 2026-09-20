# Multi-workspace deployments

> Give each workspace its own subdomain while one Masir deployment serves all of them.

Single-workspace mode is the default. Enable multi-workspace mode only when
several independent teams need their own host boundary.

## Configure the domains

Choose a root domain and an application origin. A common production layout is:

```text
example.com          landing page
app.example.com      sign-in and dashboard
acme.example.com     Acme workspace and short links
studio.example.com   Studio workspace and short links
```

Set:

```sh [.env]
NUXT_MULTI_WORKSPACE=true
NUXT_ROOT_DOMAIN=https://example.com
NUXT_APP_DOMAIN=https://app.example.com
NUXT_SESSION_COOKIE_DOMAIN=.example.com
NUXT_PUBLIC_SHORT_DOMAIN=https://example.com
```

The leading dot on the cookie domain shares the session with workspace
subdomains.

## Configure DNS and TLS

Create records for the root, application host, and wildcard workspace hosts:

```text
example.com
app.example.com
*.example.com
```

Point them at the same proxy. Use a certificate that covers the root and
wildcard hosts.

Masir rejects multi-workspace configuration with `localhost`, a bare local
name, or an IP address. Those hosts cannot provide the required wildcard and
cookie behavior.

## Understand host resolution

For each request, Masir:

1. reads the trusted host
2. separates the workspace slug from the root domain
3. loads the workspace
4. attaches its ID to the request context
5. scopes later reads and writes to that workspace

A workspace slug is permanent because it becomes part of public URLs.

## Use the root domain

When `NUXT_APP_DOMAIN` is set, the root serves the public landing page.
Without an app domain, the root is the application.

The optional public demo also needs an app domain because its button lives on
the landing page.

## Switch workspaces

The workspace switcher moves to the selected workspace host. The shared parent
cookie keeps the session active.

If switching asks for another sign-in, check that the cookie domain starts
with a dot and matches the root domain.

## Test locally

Use a dotted local domain that resolves to `127.0.0.1`. Do not use
`localhost`.

For example:

```text
masir.test
app.masir.test
acme.masir.test
```

Add the names to your hosts file, or use a local DNS service with wildcard
support. Set `NUXT_SESSION_COOKIE_SECURE=false` only while you use local HTTP.

<ReadMore to="/guide/workspaces" title="Manage workspaces inside the deployment" />

