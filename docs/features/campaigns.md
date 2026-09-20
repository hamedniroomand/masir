# Organize links

> Use tags for flexible grouping and campaigns for shared tracking values.

Tags and campaigns solve different problems. You can use both on the same
link.

## Use tags

A tag is a workspace label. Add up to 20 tag names to a link, then filter the
link list by one or more tags.

Rename a tag to update every attached link. Delete a tag to remove the
relationship. The links remain.

Use tags for owners, channels, products, review states, or any grouping that
can overlap.

## Use campaigns

A campaign groups links around one `utm_campaign` value and an optional
`utm_medium`.

Attach a link to a campaign when several links belong to the same launch or
promotion. The campaign value is applied during redirect.

A link cannot belong to a campaign and set its own `utm_campaign`. The
database enforces this rule so the two values cannot disagree.

Deleting a campaign detaches its links. It does not delete them.

## Add link-level UTM values

A link can set `utm_source`, `utm_term`, and `utm_content`. A link without
a campaign can also set `utm_campaign`.

Incoming query passthrough values can replace a generated UTM value with the
same key.

## Read campaign analytics

Campaign analytics use the same periods as link analytics. The view summarizes
campaign traffic and groups it by `utm_source`.

## Choose the right tool

| Need | Use |
|---|---|
| Group links in several ways | Tags |
| Filter the link list | Tags |
| Share one campaign name | Campaign |
| Compare sources in one promotion | Campaign |
| Add private context | Link notes |

<ReadMore to="/features/links" title="Manage the links inside a group" />

