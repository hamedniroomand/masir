# Workspaces

> Keep links, people, and analytics inside one team boundary.

Every link, tag, campaign, invitation, and workspace audit event belongs to a
workspace.

## Understand the boundary

A workspace has a name, permanent slug, optional logo, link prefix, plan
state, and exactly one owner.

Repository queries take the workspace ID as part of their input. Database
constraints keep workspace-scoped slugs and ownership valid.

## Choose one workspace or many

Single-workspace mode is the default. One team uses the configured app and
short-link domains.

Multi-workspace mode gives each workspace a subdomain:

```text
acme.example.com
studio.example.com
```

The database model is the same in both modes.

## Create a workspace

Verified users can create a workspace only in multi-workspace mode. Enter a
name and optional slug. Masir generates a slug when it is empty.

The creator becomes the owner.

A demo user cannot create another workspace.

## Treat the slug as permanent

The workspace slug becomes part of the hostname in multi-workspace mode.
Masir does not offer a rename operation. This prevents a workspace address
from changing after people share it.

## Set a link prefix

A link prefix places all workspace links below one path:

```text
https://go.example.com/go/pricing
```

An empty prefix keeps links at the root. Changing the prefix breaks previously
published paths. Masir warns before it saves the change.

## Set the name and logo

The owner can change the display name and upload a PNG, JPEG, GIF, or WebP
logo. The default upload limit is 2 MiB.

The database stores a storage key, not a public URL. Operators can move from
local file storage to S3-compatible storage without changing workspace rows.

## Review workspace activity

The owner can filter the activity log by links, campaigns, members, or
security. Results are newest first and use cursor pagination.

Global events without a workspace, such as a failed sign-in, do not appear in
this view.

## Delete a workspace

Only the owner can delete a workspace. Deletion is soft. Masir refuses to
delete the only workspace on an instance.

Back up the database and uploads before any administrative deletion.

<ReadMore to="/guide/members" title="Invite people and assign roles" />

