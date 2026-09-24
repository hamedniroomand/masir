# Create and manage links

> Keep a public address stable while its destination and rules change.

A link belongs to one workspace. Its slug is unique inside that workspace.

## Create a link

A destination is required. It must use HTTP or HTTPS. You can choose a slug or
let Masir generate one.

Masir blocks private-network destinations by default. An operator can allow
them for a trusted internal deployment.

## Change the destination

Open a link, replace its destination, and save. The short URL continues to
work. Masir records the change in the link history and workspace activity log.

## Rename a link

Changing the slug keeps the old slug as an alias by default. Both addresses
reach the same link.

Turn off **Keep old slug** only when the old address must stop resolving. The
old slug still stays reserved. Masir never gives a previously used address to
another link.

## Change link path

A workspace can set or change its link path under workspace settings.

By default, Masir preserves old link paths (`pathMode: 'preserve'`). Old links
and QR codes continue to resolve alongside new links.

Selecting `replace` stops the old link path from resolving immediately.

You can view and revoke retained paths under workspace settings. Revoking a
path permanently stops old links from resolving under that path.


## Add aliases

An alias is another slug for the same link. A link can have up to 10 active
aliases.

Removing an alias stops it from resolving but does not release its slug. This
protects old QR codes, printed material, and browser bookmarks.

## Pass query values

When query passthrough is on, Masir appends the incoming query values to the
destination.

If the destination and incoming request use the same key, the incoming value
wins. Use this for a shared link that accepts values such as a referral code.

Campaign and link UTM values are added before the incoming query values.

## Add notes

Notes are private workspace text. Visitors never receive them. Use notes for a
campaign owner, renewal date, source document, or reason for the link.

## Download a QR code

Open the QR panel to download SVG or PNG. The image contains the short URL, not
the current destination. You can change the destination without replacing the
image.

PNG sizes range from 64 to 512 pixels. SVG remains sharp at any print size.

## Review changes

The history panel shows the last 50 changes. Each row includes the user, time,
and fields that changed.

Workspace owners can use the activity log for a broader view across links,
campaigns, members, and security.

## Understand link status

Masir evaluates status in this order:

1. disabled
2. expired
3. visit limit reached
4. scheduled
5. active

The first matching state wins.

## Filter and change many links

Filter the library by search, status, tags, campaign, or creator. Open **My
links** to show only the links you created.

Select rows on the page, or select every link that matches the current
filters (up to 500). Add a tag, remove a tag, or assign a campaign in one
action. The confirm step shows the workspace name and short domain before the
change.

Custom views store the current filters in the browser under
`masir:views:{workspaceId}`.

## Delete a link

Deletion is soft. The link leaves normal lists and stops resolving. Its slug,
aliases, analytics, and audit history remain reserved or retained.

A deleted address cannot be reused.

<ReadMore to="/features/access-control" title="Control when the link works" />

