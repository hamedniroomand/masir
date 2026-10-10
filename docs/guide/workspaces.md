# Workspaces

> Keep links, people, and analytics inside one team boundary.

Every link, tag, campaign, invitation, and workspace audit event belongs to a
workspace.

## Understand the boundary

A workspace has a name, permanent slug, optional logo, link prefix, and exactly one owner.

Repository queries take the workspace ID as part of their input. Database
constraints keep workspace-scoped slugs and ownership valid.

## Use one workspace

One install serves one workspace. The seed script creates it. A second team
runs a second install.

## Treat the slug as permanent

Masir does not offer a rename operation for the workspace slug. This keeps
the identifier the same for the life of the install.

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

<ReadMore to="/guide/members" title="Invite people and assign roles" />

