# Tags and campaigns

Two ways to group links. They solve different problems, and you will often want
both.

## Tags

Free-form labels. A link takes up to 20, and the link list filters by them,
together with a search term and a status.

Tags are unique within a workspace on a normalised name, so `Docs`, `docs`, and
` DOCS ` are the same tag. Nobody has to remember how the person before them
capitalised it.

Deleting a tag removes it from every link. The links stay.

Use tags for the grouping that lasts: `docs`, `pricing`, `onboarding`,
`deprecated`.

## Campaigns

A campaign owns a `utm_campaign` value and, optionally, a `utm_medium`. Links
attached to it inherit both.

```text
Campaign "Spring launch"
  utm_campaign = spring-2026
  utm_medium   = email

  /promo      adds utm_source=newsletter
  /promo-tw   adds utm_source=twitter
```

Two links, one campaign, consistent tagging. Nobody types `spring2026` on one
link and `spring-2026` on another, which is the mistake that quietly splits a
report in two.

`utm_campaign` is unique within a workspace. A second campaign with the same
name answers `409` rather than creating a duplicate that fragments the data.

## UTM values

A link carries its own `utm_source`, `utm_term`, and `utm_content`. The
campaign supplies `utm_campaign` and `utm_medium`. A link that belongs to a
campaign cannot set its own `utm_campaign`; the form and the API both refuse
the pair, so the two can never disagree.

| Parameter | Set on | Purpose |
|---|---|---|
| `utm_campaign` | Campaign, or the link when it has no campaign | Names the campaign |
| `utm_medium` | Campaign | Shared channel type, such as `email` |
| `utm_source` | Link | The specific channel, such as `newsletter` |
| `utm_term` | Link | Paid keyword or term |
| `utm_content` | Link | Tells two placements apart |

All five are added to the destination at redirect time. From lowest to highest
precedence:

1. Query parameters already in the destination URL.
2. The link and campaign UTM values.
3. Whatever the visitor appended to the short link.

So a link shared onward with someone else's tracking keeps their attribution
intact.

## Campaign analytics

A campaign page shows clicks across its links, grouped by each link's current
`utm_source`, with the same period selector as a single link.

## Which one to use

**Tag** when you want to find the links again later.

**Campaign** when you want the clicks to land in the same bucket in Google
Analytics, Plausible, or whatever you already run.

Detaching a link from a campaign leaves the link alone and stops the inherited
values. Deleting a campaign detaches its links rather than deleting them.
