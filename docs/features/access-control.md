# Access control

Five controls, independent of each other. Combine as many as you need on one
link.

## Password

Set a password and visitors see an unlock page before the redirect. Link
passwords are hashed with argon2id, the same as account passwords, and the plain
value is never stored.

An unlock is remembered for **15 minutes** in a cookie that is scoped to one
link in one workspace:

```text
ms_pwd_<workspaceId>_<slug>
```

The cookie is `httpOnly`, carries an expiry, and is signed with HMAC-SHA256 over
`workspaceId:slug:expiry`. Unlocking one link does not unlock another, and a
grant issued in one workspace cannot unlock the same slug in a different one.

Failed attempts are rate limited per client per link:

```sh [.env]
NUXT_RATE_LIMIT_PASSWORD_PER_MINUTE=10
```

::: warning
A password stops casual access, not a determined one. Anyone who unlocks the
link can share the destination. Use it for "not indexed, not guessable", not for
protecting something confidential.
:::

## Schedule

`startsAt` holds the link until a moment you choose. Before then it answers
**404**, exactly like a link that does not exist. It goes live the second the
time passes, with no job to run and nothing to remember.

Useful for a launch announcement that goes into a printed programme weeks
early.

## Expiry

`expiresAt` retires a link. Two behaviours:

**Without an expiration destination** the link answers 404.

**With one**, the link redirects there instead. Send people to a "this offer
ended" page rather than a dead end. This is almost always the better choice —
a 404 tells the visitor nothing and makes your organisation look broken.

## Visit cap

`maximumVisits` stops a link after a number of **successful** redirects.

Blocked attempts do not count. A failed password, a request from a bot, a
click after expiry — none of these consume the allowance. The counter moves
only when somebody actually reached the destination.

The increment is a single atomic statement:

```sql
update links
set successful_visit_count = successful_visit_count + 1
where id = $1 and (maximum_visits is null or successful_visit_count < maximum_visits)
```

The database decides, not the application. Ten simultaneous clicks on a
one-visit link let exactly one through — there is no window between reading the
count and writing it.

## Disable

A switch. The link answers 404 while it is off and keeps its analytics, its
slug, and its history. Turn it back on and everything resumes.

Prefer disabling over deleting when you are not certain. Deleting reserves the
slug permanently in that workspace.

## What visitors see

Every blocked state answers **404**, deliberately. A visitor cannot tell a
disabled link from an expired one from a slug that was never created, so the
error page leaks nothing about what a workspace holds.

Your team sees the real reason in the dashboard.
