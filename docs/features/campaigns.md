# Tags and campaigns

Two ways to group links. They solve different problems, and you will usually
want both.

## Tags

Free-form labels. A link takes as many as you like, and the list filters by
them.

Tags are unique within a workspace on a normalized name, so `Docs`, `docs`, and
` DOCS ` are the same tag. Nobody has to remember how the person before them
capitalised it.

Use tags for the grouping that survives — `docs`, `pricing`, `onboarding`,
`deprecated`.

## Campaigns

A campaign owns a UTM campaign name and, optionally, a medium. Links attached to
it inherit both.

```text
Campaign "Spring 2026 launch"
  utm_campaign = spring-2026
  utm_medium   = email

  /promo    → adds utm_source=newsletter
  /promo-tw → adds utm_source=twitter
```

Two links, one campaign, consistent tagging. Nobody types `spring2026` on one
link and `spring-2026` on another, which is the failure that quietly splits a
report in two.

`utm_campaign` is unique within a workspace. The same name cannot exist twice,
so a second campaign returns **409 Conflict** rather than creating a duplicate
that fragments the data.

## UTM values

A link carries `utm_source`, `utm_term`, and `utm_content` of its own. The
campaign supplies `utm_campaign` and `utm_medium`.

All five are appended to the destination at redirect time. Whatever the visitor
already sent wins, so a link shared onward with someone else's tracking keeps
their attribution intact.

## Which one to use

**Tag** when you want to find the links again.

**Campaign** when you want the clicks to land in the same bucket in Google
Analytics, Plausible, or whatever you already run.

Detaching a link from a campaign leaves the link alone and stops the inherited
UTM values. Deleting a campaign detaches its links rather than deleting them.
