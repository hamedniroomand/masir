# Access control

Five controls, independent of each other. Combine as many as you need on one
link.

## Password

Set a password and visitors see an unlock page before the redirect. Link
passwords are hashed with argon2id, the same as account passwords, and the plain
value is never stored.

A successful unlock is remembered for **15 minutes** in a cookie scoped to one
link in one workspace. The cookie is `httpOnly`, carries its expiry, and is
signed, so unlocking one link does not unlock another, and a grant from one
workspace cannot open the same slug in a different one.

The destination is never sent to the browser before the check passes. Viewing
the unlock page does not count as a click, and a wrong password does not use up
a visit. Failed attempts are rate limited per client per link, 10 a minute by
default.

::: warning A password is not confidentiality
It stops casual access. Anyone who unlocks the link can pass the destination
on. Use it for "not indexed, not guessable", not for protecting something
secret.
:::

## Schedule

A **start date** holds the link until a moment you choose. Before then it
answers 404, exactly like a link that does not exist. It goes live the second
the time passes, with no job to run and nothing to remember.

Useful for a launch announcement that goes into a printed programme weeks
early.

Set a **before the start time** destination and the link redirects there
instead of answering 404. Send people to a "coming soon" page while they wait.
The redirect is recorded as its own outcome and does not count as a click.

## Expiry

An **expiry date** retires a link. What happens next depends on whether you set
an expiration destination.

**Without one**, the link answers 404.

**With one**, the link redirects there instead. Send people to a "this offer
has ended" page rather than a dead end. This is almost always the better
choice. A 404 tells the visitor nothing and makes you look broken.

Start must be before expiry. A redirect to the expiration destination is
recorded as its own outcome and does not count as a click.

## Visit cap

A **maximum visits** value stops a link after a number of **successful**
redirects. Blocked attempts do not count: a failed password, a bot request, a
click after expiry. The counter moves only when somebody actually reached the
destination.

The increment is one atomic statement, so the database decides:

```sql
update links
set click_count = click_count + 1
where id = $1 and deleted_at is null
  and (maximum_visits is null or click_count < maximum_visits)
```

Ten simultaneous clicks on a one-visit link let exactly one through. There is
no window between reading the count and writing it.

A **one-time link** is a cap of one. You can raise or remove the cap later. The
count of visits already used does not reset when you do.

Set an **after the visit cap** destination and a visitor who arrives too late
goes there instead of a 404. The redirect is recorded as its own outcome, does
not count as a click, and does not use a visit, so the cap stays where it is.

## Disable

A switch. The link answers 404 while it is off and keeps its analytics, its
slug, and its history. Turn it back on and everything resumes.

Prefer disabling over deleting when you are not certain.

## What visitors see

Every blocked state answers **404** on purpose, **unless you set a fallback**.
A visitor cannot tell a disabled link from an expired one from a slug that was
never created, so the error page leaks nothing about what a workspace holds.

Expiry, the start time, and the visit cap each take a fallback destination. A
disabled link always answers 404, because switching a link off is the way to
stop it completely.

Your team sees the real reason in the dashboard, and the
[outcome breakdown](/features/analytics#outcomes) shows how often each block
happened.
