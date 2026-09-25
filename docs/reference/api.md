# HTTP API

> Masir exposes the same JSON routes used by its web interface.

There is no API-token system. Authenticate with a user session unless a route
is marked public or uses the jobs bearer secret.

## Session authentication

Sign in and save the cookie:

```sh
curl -sS -X POST https://go.example.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}' \
  -c cookie.txt
```

Send `-b cookie.txt` with later requests.

In multi-workspace mode, send workspace requests to that workspace's
subdomain. The host selects the workspace. A request body cannot select one.

## Request security

Unsafe browser requests with an `Origin` header must use an origin that
matches the request host. This protects cookie-authenticated routes from
cross-site form requests.

A command-line request without `Origin` is accepted.

Rate-limited requests return `429` and a `Retry-After` header. Resource
lookups that the current user cannot access return `404` instead of revealing
that a row exists.

## Permission names

| Permission | Owner | Member | Viewer |
|---|:---:|:---:|:---:|
| `workspace.manage` | Yes | No | No |
| `workspace.delete` | Yes | No | No |
| `members.manage` | Yes | No | No |
| `links.manage` | Yes | Yes | No |
| `links.read` | Yes | Yes | Yes |
| `analytics.read` | Yes | Yes | Yes |

## Health and host context

| Method | Route | Authentication | Result |
|---|---|---|---|
| `GET` | `/api/health` | Public | App and database health, or `503` |
| `GET` | `/api/host` | Public | Host and deployment context used by the interface |

## Authentication

| Method | Route | Input or result |
|---|---|---|
| `GET` | `/api/auth/providers` | Enabled providers and registration state |
| `POST` | `/api/auth/register` | `email`, `password` |
| `POST` | `/api/auth/demo` | Optional `turnstileToken`; creates or resumes a demo |
| `POST` | `/api/auth/verify` | Verification `token` |
| `POST` | `/api/auth/verify/resend` | Sends a new verification link |
| `POST` | `/api/auth/login` | `email`, `password`; sets the session |
| `POST` | `/api/auth/logout` | Clears the session |
| `POST` | `/api/auth/forgot` | `email`; always returns a neutral result |
| `POST` | `/api/auth/reset` | `token`, `password`; invalidates all sessions |
| `GET` | `/api/auth/google` | Starts or finishes Google OAuth |
| `GET` | `/api/auth/microsoft` | Starts or finishes Microsoft OAuth |
| `GET` | `/api/auth/identities` | Connected sign-in methods |
| `DELETE` | `/api/auth/identities/:id` | Removes one identity; rejects the last one |

The demo route returns `404` when the feature is off. It returns a workspace
URL when it creates or resumes a live demo session.

## Workspaces

| Method | Route | Required access | Input or result |
|---|---|---|---|
| `GET` | `/api/workspaces` | Signed in | Current memberships |
| `POST` | `/api/workspaces` | Verified account | `name`, optional `slug`, optional `linkPrefix` |
| `PATCH` | `/api/workspaces` | `workspace.manage` | `name`, `linkPrefix`, optional `pathMode: 'preserve' \| 'replace'` |
| `DELETE` | `/api/workspaces` | `workspace.delete` | Soft-deletes the current workspace |
| `GET` | `/api/workspaces/link-prefixes` | `workspace.manage` | Retained link paths |
| `DELETE` | `/api/workspaces/link-prefixes/:prefix` | `workspace.manage` | Revokes a retained link path |
| `GET` | `/api/workspaces/analytics` | `analytics.read` | `period`, or `from`/`to` (`YYYY-MM-DD`), optional `compare=previous` |
| `GET` | `/api/workspaces/analytics.csv` | `analytics.read` | Same filters as `/api/workspaces/analytics` |
| `GET` | `/api/workspaces/slug-available?slug=` | Signed in | Workspace slug availability |
| `POST` | `/api/workspaces/logo` | `workspace.manage` | Multipart PNG, JPEG, GIF, or WebP |
| `DELETE` | `/api/workspaces/logo` | `workspace.manage` | Removes the logo |
| `POST` | `/api/workspaces/transfer-ownership` | `members.manage` | `userId` |

Single-workspace mode rejects another workspace. Masir also rejects deletion
of the only workspace on an instance.

## Members and invitations

| Method | Route | Required access | Input or result |
|---|---|---|---|
| `GET` | `/api/workspaces/members` | `members.manage` | Memberships |
| `GET` | `/api/workspaces/members/options` | `links.manage` | Active members for assignment |
| `PATCH` | `/api/workspaces/members/:id` | `members.manage` | Optional `role`, `isActive` |
| `DELETE` | `/api/workspaces/members/:id` | `members.manage` | Removes a non-owner |
| `GET` | `/api/workspaces/invitations` | `members.manage` | Open invitations |
| `POST` | `/api/workspaces/invitations` | `members.manage` | `email`, optional `role` |
| `POST` | `/api/workspaces/invitations/:id/resend` | `members.manage` | Replaces the token and sends again |
| `DELETE` | `/api/workspaces/invitations/:id` | `members.manage` | Revokes an invitation |
| `POST` | `/api/workspaces/invitations/accept` | Invited user | `token` |

An invitation role is `MEMBER` or `VIEWER`. The default is `MEMBER`.

## Links

| Method | Route | Required access | Input or result |
|---|---|---|---|
| `GET` | `/api/links` | `links.read` | Paginated and filtered links |
| `POST` | `/api/links` | `links.manage` | Creates a link |
| `POST` | `/api/links/batch` | `links.manage` | Creates up to 20 rows in one request |
| `POST` | `/api/links/bulk` | `links.manage` | Tags, untags, assigns a campaign, or archives many links |
| `POST` | `/api/links/import/preview` | `links.manage` | Multipart CSV preview (max 1 MB, 1000 rows) |
| `POST` | `/api/links/import` | `links.manage` | Creates rows from a previewed import |
| `GET` | `/api/links/export.csv` | `links.read` | CSV of the current list filters |
| `GET` | `/api/links/:id` | `links.read` | Link and creator |
| `PATCH` | `/api/links/:id` | `links.manage` | Updates provided fields, including responsibility and archive |
| `DELETE` | `/api/links/:id` | `links.manage` | Soft-deletes a link |
| `GET` | `/api/links/:id/analytics` | `links.read` | `period` or `from`/`to`, `traffic`, optional `compare=previous` |
| `GET` | `/api/links/:id/analytics.csv` | `links.read` | Same filters as `/api/links/:id/analytics` |
| `GET` | `/api/links/:id/history` | `links.read` | Last 50 changes |
| `POST` | `/api/links/:id/aliases` | `links.manage` | `slug` |
| `DELETE` | `/api/links/:id/aliases/:slug` | `links.manage` | Revokes the alias |
| `GET` | `/api/links/:id/qr` | `links.read` | `format` and `size` |

List filters include `page`, `perPage`, `sort`, `status`, `q`,
`tags`, exact normalized `destination`, `campaignId`, `createdBy` (`me` or a
user id), `archived` (default `false`), and `needsReview`.

A bulk request sends `{ selection: { ids } | { filter }, action, tagId?,
campaignId? }`. `action` is `tag`, `untag`, `assignCampaign`, or `archive`.
The server resolves a filter inside the workspace, caps the set at 500, and
answers 422 above the cap. Ids outside the workspace answer 404 with no
change. The response is `{ affected, results }`. One audit event
`links_bulk_action { action, count }` is written.

### Link input

| Field | Type | Rule |
|---|---|---|
| `destinationUrl` | string | Required on create; HTTP or HTTPS |
| `slug` | string | Generated when empty |
| `title` | string or null | Optional display title |
| `startsAt` | number or null | Unix milliseconds |
| `expiresAt` | number or null | Must follow `startsAt` |
| `scheduledDestination` | string or null | Fallback before opening |
| `expirationDestination` | string or null | Fallback after expiry |
| `limitDestination` | string or null | Fallback after the visit cap |
| `maximumVisits` | integer or null | Minimum 1 |
| `password` | string or null | Sets, replaces, or clears the password |
| `campaignId` | string or null | Cannot combine with `utmCampaign` |
| `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent` | string or null | Tracking values; `utmMedium` overrides the campaign medium |
| `responsibleUserId` | string or null | Active workspace member |
| `reviewAt` | number or null | Unix milliseconds |
| `archived` | boolean | Sets or clears `archived_at` |
| `tags` | string[] | Up to 20 names |
| `notes` | string or null | Private workspace text |
| `targeting` | object or null | Country and OS destinations |

A slug change keeps the old slug as an alias unless `keepOldSlug` is false.

### Batch create

`POST /api/links/batch` accepts `{ campaignId?, destinationUrl, title?, items }`
where `items` is up to 20 `{ clientKey, utmSource, utmMedium?, utmContent?,
slug? }`. It returns `{ results: [{ clientKey, status, link?, error? }] }`.
A validation error answers 422 with `{ rows: [{ clientKey, error }] }` and
creates nothing.

### CSV import and export

`POST /api/links/import/preview` accepts multipart form field `file`. It
returns `{ importId, fileHash, rowCount, rows }` where each row is
`{ row, values, errors }`. Columns map by header name. Dates are ISO 8601 with
an offset or `Z`. Tags use `|`.

`POST /api/links/import` accepts `{ importId, fileHash, rows }`. It returns
`{ results: [{ row, status, linkId?, error? }] }` where `status` is `created`,
`already_imported`, `conflict`, or `error`. A slug conflict never overwrites an
existing link.

`GET /api/links/export.csv` uses the same filters as `GET /api/links`. Columns
are the import columns plus `short_url`, `created_at`, and `lifetime_clicks`.
`notes` is included only with `links.manage`. `password_hash` is never
exported.

## Public visitor routes

| Method | Route | Input or result |
|---|---|---|
| `GET` | `/api/links/public/:slug` | Unlock-page link state |
| `POST` | `/api/links/verify-password` | `slug`, `password`; sets a grant cookie |
| `POST` | `/api/report` | `slug`, `reason`; neutral acknowledgement |

These routes do not need a user session.

## Tags and campaigns

| Method | Route | Required access |
|---|---|---|
| `GET` | `/api/tags` | `links.read` |
| `POST` | `/api/tags` | `links.manage` |
| `PATCH` | `/api/tags/:id` | `links.manage` |
| `DELETE` | `/api/tags/:id` | `links.manage` |
| `GET` | `/api/campaigns` | `links.read` |
| `POST` | `/api/campaigns` | `links.manage` |
| `GET` | `/api/campaigns/:id` | `links.read` |
| `PATCH` | `/api/campaigns/:id` | `links.manage` |
| `DELETE` | `/api/campaigns/:id` | `links.manage` |
| `GET` | `/api/campaigns/:id/analytics` | `links.read` |
| `GET` | `/api/campaigns/:id/analytics.csv` | `links.read` |

Campaign analytics accepts `period` or `from`/`to`, `attribution`, and optional
`compare=previous`, matching the link analytics filters.

`GET /api/campaigns/:id/analytics.csv`, `GET /api/links/:id/analytics.csv`, and
`GET /api/workspaces/analytics.csv` download the same range as CSV. The file
starts with `key,label,definition,value` rows for metrics and report meta, then
a blank line, then `bucket,count` series rows. When the JSON report has
breakdowns, a `section,label,count` block follows (referrer, country, device,
browser; campaign also includes source and medium). Workspace and campaign
files add a `slug,title,clicks` top-links block. Notes and link ids are never
included. The value-bearing header is intentional; range and traffic live in
meta rows and in `shared/analytics-metrics.ts` rather than a `# metric,...`
comment line.

A tag input is `name`. A campaign uses `name`, `utmCampaign`, and optional
`utmMedium`.

## Audit events

`GET /api/admin/audit-events` requires `workspace.manage`.

Filters include `group`, `type`, `limit`, and `before`. The response is
newest first and includes `nextBefore` for cursor pagination.

## Scheduled jobs

`POST /api/jobs/alerts` uses:

```text
Authorization: Bearer <NUXT_JOBS_SECRET>
```

It runs every maintenance job that is due. It returns `404` when no secret is
set and `401` for a wrong secret. On success it returns `sent`, the number of
alerts sent, and `demosDeleted`, the number of demos deleted. `jobs` holds one
report for each job, with `job`, `status` (`ran`, `skipped`, or `failed`), and
an optional `count`, `detail`, or `error`. The `click_event_partitions` job
runs every 24 hours. Its `count` is the number of months it checked, and its
`detail` holds `partitionsReadyThrough`, the exclusive end date of the
newest `click_events` partition. When a job fails, the other jobs still run
and the route returns `500` after the other jobs ran.

## Operator status

`GET /api/admin/status` uses either:

- A session cookie for a user whose email is in `NUXT_OPERATOR_EMAILS`
- `Authorization: Bearer <NUXT_JOBS_SECRET>`

It returns `404` when the user is not in `NUXT_OPERATOR_EMAILS`, when no secret
is set, or for an invalid bearer token. On success, it returns:

```json
{
  "version": "1.0.1",
  "jobs": [
    {
      "job": "expiry_alerts",
      "lastStartedAt": "2026-09-23T20:00:00.000Z",
      "lastSuccessAt": "2026-09-23T20:00:01.000Z",
      "lastErrorAt": null,
      "lastError": null,
      "nextDueAt": "2026-09-23T20:15:00.000Z",
      "overdue": false,
      "status": "ok",
      "nextAction": null
    }
  ],
  "signals": [
    {
      "key": "event_write",
      "state": "ok",
      "detail": null,
      "updatedAt": "2026-09-23T20:00:00.000Z"
    }
  ],
  "partitionsReadyThrough": "2026-12-01T00:00:00.000Z"
}
```

An overdue job (whose `nextDueAt` is older than two intervals) has
`overdue: true`, `status: "failed"`, and a recommended `nextAction`.

## Upload delivery

`GET /uploads/*` serves file-storage objects. S3-compatible storage uses the
configured public base URL instead.

