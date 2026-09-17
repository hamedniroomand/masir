# Short links

## Slugs

Leave the slug empty and Linkyard generates a seven-character one from an
alphabet of 31 characters that omits `0`, `1`, `i`, `l`, and `o`. Those are the
ones people misread from a slide or mistype from a printed page.

Type your own slug for something memorable. Slugs are unique within a
workspace, so two teams can both own `pricing`.

A slug cannot collide with an application route. `login`, `settings`, `api`,
and the rest are reserved, and a test in the repository fails if somebody adds
a page without reserving its path.

## Editing the destination

This is the feature that justifies a shortener. Change where a link points and
every copy you already shared follows.

Linkyard answers with a **302**, not a 301. A permanent redirect is cached hard
by browsers, and you would lose the ability to move anyone who had already
clicked.

## Reserved slugs after deletion

Deleting a link records its slug as reserved in that workspace. Creating the
same slug again is refused.

The reason is that people bookmark and republish short links. Reusing a slug
sends everybody holding the old one to a destination they did not expect, which
is the one thing a link shortener must never do by accident.

Reservations are per workspace. Another team can still use the slug.

## Query passthrough

Whatever a visitor appends to the short link is merged into the destination:

```text
go.example.com/pricing?ref=twitter
  → example.com/plans?utm_source=newsletter&ref=twitter
```

Values the visitor sends win over the link's own UTM values, so a campaign link
can still be attributed correctly when somebody adds their own tracking.

## QR codes

Every link has a QR code, as SVG or PNG, at sizes from 64 to 512 pixels.

```text
/api/links/:id/qr?format=png&size=512
```

Because the code encodes the short link and not the destination, printing one
is safe — you can still change where it goes.

## Status

A link is always in exactly one state, derived on read rather than stored:

| Status | Meaning |
|---|---|
| `active` | Resolving normally |
| `disabled` | Switched off by hand |
| `scheduled` | Start date is in the future |
| `expired` | Past its expiry date |
| `limit_reached` | Visit cap is used up |

Deriving instead of storing means a link becomes active the second its start
time passes, with no scheduled job involved.
