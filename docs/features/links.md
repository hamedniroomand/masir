# Short links

A link is a slug, a destination, and a set of rules about when the redirect is
allowed. This page covers the slug and the destination. The rules are on
[Access control](/features/access-control).

## Slugs

Leave the slug empty and Masir generates a seven-character one from an alphabet
of 31 characters. It leaves out `0`, `1`, `i`, `l`, and `o`, the characters
people misread from a slide or mistype from a printed page.

Type your own slug for something memorable. Slugs are unique within a
workspace, so two teams can both own `pricing`.

A slug cannot collide with an application route. `login`, `settings`, `api`,
`p`, and the rest are reserved, and a test in the repository fails if somebody
adds a page without reserving its path.

## Editing the destination

This is the feature that justifies a shortener. Change where a link points and
every copy you already shared follows.

Masir answers with a **302**, not a 301. Browsers cache a permanent redirect
hard, and you would lose the ability to move anyone who had already clicked.

Destinations must be `http` or `https`. Private and local addresses are refused
by default, and a link cannot point back at itself. See
[Destination validation](/project/security#destination-validation).

## Notes

Each link holds a private note of at most 2000 characters. Use it for why the
link exists, who asked for it, or where it is printed.

Write the note in the **Notes** card on the Settings tab, or in the **Tags and
notes** group of the create form. The Overview tab shows it above the
analytics.

The note never reaches a visitor. Only your workspace reads it. Link search
matches the note, so you can find a link by a word that appears nowhere else.

## Aliases and renaming

A link holds one **short address** and up to 10 **extra addresses**. Every one
of them reaches the same destination.

Change the short address in the **Destination** card on the Settings tab. Leave
**Keep /old working as an alias** on, which is the default, and every copy you
already shared keeps working. Turn it off and the old address stops working at
once.

Add and remove extra addresses in the **Extra addresses** card.

A removed extra address stops working but stays **reserved**. So does the old
address of a rename you did not keep, and so does the address of a deleted
link. An address that once worked never returns to the pool, so a QR code on a
printed poster can never start pointing at somebody else's destination.

The QR code and the copy button always use the short address, not an alias.

## Query passthrough

Whatever a visitor appends to the short link is merged into the destination:

```text
go.example.com/pricing?ref=twitter
  becomes
example.com/plans?utm_source=newsletter&ref=twitter
```

Values the visitor sends win over the link's own UTM values, so a campaign link
stays correctly attributed when somebody adds their own tracking.

## QR codes

Every link has a QR code, as SVG or PNG, at sizes from 64 to 512 pixels:

```text
/api/links/:id/qr?format=png&size=512
```

The code encodes the short link, not the destination, so printing it is safe.
You can still change where it goes.

## History

The **History** tab on a link lists the last 50 changes: who made each one,
when, and which fields moved. It reads from the same audit log that records
member changes and sign-in failures.

## Status

A link is always in exactly one state, worked out when it is read rather than
stored:

| Status | Meaning |
|---|---|
| `active` | Resolving normally |
| `disabled` | Switched off by hand |
| `scheduled` | Start date is in the future |
| `expired` | Past its expiry date |
| `limit_reached` | Visit cap used up |

When more than one applies, `disabled` wins, then `expired`, then
`limit_reached`, then `scheduled`. Deriving instead of storing means a link
becomes active the second its start time passes, with no scheduled job
involved.

## Deleting a link

Deleting keeps the row with a `deleted_at` timestamp. Two things follow.

**The slug stays taken** in that workspace, and so does every extra address the
link held. People bookmark and republish short links, and reusing an address
would send everyone holding the old one to a destination they did not expect.
Another workspace can still use it.

**The click history stays** readable, so a report that included the link still
adds up.

If you are not sure, disable the link instead. It answers 404 while it is off
and everything resumes when you turn it back on.
