# Troubleshooting

> Start with the symptom, check the named input, and verify the result after each change.

## The app exits during startup

**Likely cause:** runtime validation rejected a value.

Read the first error line. It names the variable and accepted shape. Common
causes are a short session password, an invalid origin, missing multi-workspace
cookie domain, local storage on serverless, or an invalid Sentry value.

## Health returns 503

**Likely cause:** Masir cannot query Postgres.

Check the database health, connection URL, network, credentials, and Postgres
18 version. In Compose, also check the `db` service log.

## Sign-in returns to the login page

**Likely cause:** the browser did not send the session cookie.

Confirm HTTPS and `NUXT_SESSION_COOKIE_SECURE=true`. On private plain HTTP,
set it to `false`. Also confirm that the public origin matches the address in
the browser.

## Workspace switching asks for sign-in

**Likely cause:** the cookie is scoped to one host.

Set `NUXT_SESSION_COOKIE_DOMAIN` to the parent domain with a leading dot, such
as `.example.com`. Restart and sign in again.

## OAuth reports a redirect mismatch

**Likely cause:** the callback registered with the provider does not match the
public application origin.

Check `NUXT_ROOT_DOMAIN`, `NUXT_APP_DOMAIN`, the proxy host, and the exact
callback in the Google or Microsoft console.

## Country is empty

**Likely cause:** no trusted country header reaches Masir.

Set `NUXT_GEO_COUNTRY_HEADER` to the header written by your CDN or proxy.
Inspect a request at the app and confirm the proxy removes any client-supplied
copy first.

## Many users share one rate limit

**Likely cause:** Masir sees the proxy address as the client.

Set `NUXT_TRUSTED_PROXY_DEPTH` to the exact number of trusted proxies. Do not
increase it beyond the real chain.

## Rate limits differ between instances

**Likely cause:** each process uses its own memory counters.

Set `NUXT_REDIS_URL` to a shared `rediss://` endpoint.

## Postgres reports too many clients

**Likely cause:** pool size multiplied by instance count exceeds the database
limit.

Lower `NUXT_DATABASE_POOL_MAX`, reduce instances, or use a pooler. Serverless
deployments usually need a value of one or two.

## Invitation or recovery mail does not arrive

**Likely cause:** no mail provider is active or the provider rejected the
message.

Check the startup line that names the selected mail driver. Review SMTP or
Resend credentials, sender authorization, and application logs. With no
provider, Masir writes the message to the log.

## A link exists but returns 404

Check the workspace host, link prefix, slug, enabled state, schedule, expiry,
visit limit, and deletion state. An unavailable link can also show the generic
unavailable page instead of revealing its state.

## One instance serves an old destination

**Likely cause:** an instance has stale in-memory link cache data or traffic is
reaching deployments with different databases.

Confirm all instances use the same Postgres database and version. Restart the
stale instance. Link writes invalidate the cache by link ID and slug.

## The app cannot store a logo

Check the selected storage provider and upload limit. File storage needs a
writable durable volume. Serverless and multi-instance deployments should use
S3-compatible storage.

## Continue diagnosis

Collect the Masir version, deployment shape, first relevant log line, health
response, and the configuration names involved. Remove all secret values
before sharing logs.

<ReadMore to="/project/security" title="Review the security boundaries" />

