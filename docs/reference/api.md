# HTTP API

Everything the interface does goes through these routes, and you can call them
yourself. There is no separate API token yet. Requests authenticate with the
same session cookie the browser uses.

## Authentication

Sign in once and keep the cookie:

```sh
curl -s -X POST https://go.example.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' \
  -c cookie.txt
```

Send it with every later request using `-b cookie.txt`.

In multi-workspace mode, call workspace routes on the workspace's own
subdomain. The server takes the workspace from the hostname, never from the
request body.

### Origin check

A `POST`, `PATCH`, `PUT`, or `DELETE` that carries an `Origin` header must have
one that matches the `Host`. Browsers always send it on a cross-site request,
so this stops a cross-site form post. A request without an `Origin`, which is
what `curl` and most HTTP libraries send, is accepted.

### Errors

Every error is a JSON body with `statusCode` and `statusMessage`. A validation
error explains which field failed. A request for something you cannot see
answers `404`, never `403`, so the response does not confirm that the thing
exists.

Rate-limited requests answer `429` with a `Retry-After` header.

## Health

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/health` | `{ "ok": true, "database": "up" }`, or `503` when Postgres is unreachable. No session needed |

## Auth

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/auth/providers` | Which sign-in methods are on, and whether registration is open |
| `POST` | `/api/auth/register` | `email`, `password`. Sends a verification link |
| `POST` | `/api/auth/verify` | `token` from the email |
| `POST` | `/api/auth/verify/resend` | Send a new verification link |
| `POST` | `/api/auth/login` | `email`, `password`. Sets the session cookie |
| `POST` | `/api/auth/logout` | Clears the session |
| `POST` | `/api/auth/forgot` | `email`. Always answers the same way |
| `POST` | `/api/auth/reset` | `token`, `password`. Signs out every device |
| `GET` | `/api/auth/google` | Start or finish the Google flow |
| `GET` | `/api/auth/microsoft` | Start or finish the Microsoft flow |
| `GET` | `/api/auth/identities` | Sign-in methods connected to your account |
| `DELETE` | `/api/auth/identities/:id` | Disconnect one. The last one answers `422` |

## Workspaces

| Method | Route | Who | Notes |
|---|---|---|---|
| `GET` | `/api/workspaces` | anyone signed in | Your memberships |
| `POST` | `/api/workspaces` | anyone verified | `name`, optional `slug`. Refused with `409` in single-workspace mode |
| `PATCH` | `/api/workspaces` | owner | `name` |
| `DELETE` | `/api/workspaces` | owner | Soft delete. The only workspace of an instance is refused |
| `GET` | `/api/workspaces/slug-available?slug=` | anyone | Whether a workspace address is free |
| `POST` | `/api/workspaces/logo` | owner | Multipart image. PNG, JPEG, GIF, or WebP |
| `DELETE` | `/api/workspaces/logo` | owner | Remove the logo |
| `POST` | `/api/workspaces/transfer-ownership` | owner | `userId` of the new owner |

### Members

| Method | Route | Who | Notes |
|---|---|---|---|
| `GET` | `/api/workspaces/members` | owner | Every membership with `userId`, role, and status |
| `PATCH` | `/api/workspaces/members/:userId` | owner | `isActive`, `role` (`MEMBER` or `VIEWER`). Both optional. Refused on the owner |
| `DELETE` | `/api/workspaces/members/:userId` | owner | Remove. Refused on the owner |

### Invitations

| Method | Route | Who | Notes |
|---|---|---|---|
| `GET` | `/api/workspaces/invitations` | owner | Open invitations |
| `POST` | `/api/workspaces/invitations` | owner | `email`, optional `role` (`MEMBER` or `VIEWER`, default `MEMBER`). An open invitation for the same address answers `409` |
| `POST` | `/api/workspaces/invitations/:id/resend` | owner | New token, new email. The old link stops working |
| `DELETE` | `/api/workspaces/invitations/:id` | owner | Revoke |
| `POST` | `/api/workspaces/invitations/accept` | the invited user | `token`. The email must match the signed-in account. The member joins with the role on the invitation |

## Links

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/links` | `page`, `perPage`, `sort` (`createdAt` or `clicks`), `status`, `search`, `tags`, `destination` (exact match after normalisation) |
| `POST` | `/api/links` | Create. See the fields below |
| `GET` | `/api/links/:id` | One link, with its `creator` |
| `PATCH` | `/api/links/:id` | Update any field. `slug` renames the link and, unless `keepOldSlug` is `false`, keeps the old address as an alias |
| `DELETE` | `/api/links/:id` | Soft delete. The slug and every alias stay taken |
| `GET` | `/api/links/:id/analytics` | `period` (`24h`, `7d`, `30d`, `all`), `traffic` (`human`, `bot`, `all`) |
| `GET` | `/api/links/:id/history` | The last 50 changes, with who and which fields |
| `POST` | `/api/links/:id/aliases` | `slug`. An extra address for the link. `409` when taken, `422` at ten |
| `DELETE` | `/api/links/:id/aliases/:slug` | Stop an extra address. The slug stays taken |
| `GET` | `/api/links/:id/qr` | `format` (`svg` or `png`), `size` (64 to 512) |

A link takes these fields on create and update:

| Field | Type | Notes |
|---|---|---|
| `destinationUrl` | string | Required on create. `http` or `https` |
| `slug` | string | Optional on create, generated when empty. Immutable after |
| `title` | string or null | |
| `startsAt` | number or null | Unix milliseconds |
| `expiresAt` | number or null | Unix milliseconds. Must be after `startsAt` |
| `expirationDestination` | string or null | Where an expired link redirects |
| `maximumVisits` | integer or null | At least 1. `null` means no limit |
| `password` | string or null | Set, replace, or clear |
| `campaignId` | string or null | Cannot be combined with `utmCampaign` |
| `utmSource`, `utmCampaign`, `utmTerm`, `utmContent` | string or null | |
| `tags` | string array | Up to 20 names |

The response carries the link with its `status`, `shortUrl`, `clickCount`, and
`successfulVisitCount`.

### Visitor routes

These are used by the pages a visitor sees. They need no session.

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/links/public/:slug` | Whether the slug behind the unlock page exists and needs a password |
| `POST` | `/api/links/verify-password` | `slug`, `password`. Sets the unlock cookie |
| `POST` | `/api/report` | `slug`, `reason`. Abuse report, always acknowledged |

## Jobs

This route carries a bearer token, not a session. A scheduler calls it.

| Method | Route | Notes |
|---|---|---|
| `POST` | `/api/jobs/alerts` | Run the expiry alert sweep. Needs `Authorization: Bearer <NUXT_JOBS_SECRET>`. Answers `404` with no secret set, `401` with a wrong one, and `{ "sent": n }` otherwise |

## Tags

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/tags` | Every tag with its link count |
| `POST` | `/api/tags` | `name`, up to 40 characters |
| `PATCH` | `/api/tags/:id` | `name` |
| `DELETE` | `/api/tags/:id` | Removes the tag from every link. The links stay |

## Campaigns

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/campaigns` | |
| `POST` | `/api/campaigns` | `name`, `utmCampaign`, optional `utmMedium`. A duplicate `utmCampaign` answers `409` |
| `GET` | `/api/campaigns/:id` | |
| `PATCH` | `/api/campaigns/:id` | |
| `DELETE` | `/api/campaigns/:id` | Detaches its links |
| `GET` | `/api/campaigns/:id/analytics` | Same `period` as a link, grouped by `utm_source` |

## Audit log

| Method | Route | Who | Notes |
|---|---|---|---|
| `GET` | `/api/admin/audit-events` | owner | The last 200 events in the workspace. Optional `type` filter |

Rows carry `type`, `actorId`, `linkId`, a JSON `detail`, and `createdAt`.
Events with no workspace, such as sign-in failures and abuse reports, never
appear here.

## Uploads

| Method | Route | Notes |
|---|---|---|
| `GET` | `/uploads/*` | Serves a logo when the file storage provider is in use |
