# Control link access

> Decide who can open a link and when it is available.

Access rules work together. Masir evaluates link status before it checks a
password or chooses a targeted destination.

## Add a password

Set a password in the link access settings. Masir stores an Argon2id hash, not
the password.

A visitor enters the password on the unlock page. A signed cookie remembers
the grant for that link. Changing or removing the password invalidates the old
grant.

Password attempts have their own rate limit.

## Schedule the opening time

Set **Starts at** when the link must not open before a date and time.

Before that time, Masir shows the unavailable page or sends the visitor to the
scheduled fallback destination. The link becomes active without a background
job.

## Set an expiry time

Set **Expires at** to stop the link at a date and time. It must be later than
the opening time.

An expired link shows the unavailable page unless you set an expiry fallback
destination.

## Limit successful visits

Set a positive visit limit. A value of one creates a one-time link.

Only successful human redirects consume the limit. Bots, password failures,
scheduled requests, expired requests, and disabled requests do not.

Masir increments the counter atomically. Concurrent requests cannot pass a
limit that has one visit left.

## Add fallback destinations

You can set separate destinations for:

- a link that has not opened
- an expired link
- a link that reached its visit limit

When a fallback exists, Masir sends the visitor there. Without one, Masir
shows the unavailable page.

## Disable a link

Turn off **Enabled** for an immediate stop. Disabled status has the highest
priority, so no other rule can make the link resolve.

## Send alerts

Masir can email the workspace owner before a link expires or approaches its
visit limit.

A long-running server checks on an interval. A serverless deployment calls the
protected alerts job from a scheduler. Each alert uses a claim stamp so
several instances do not send it twice.

<ReadMore to="/guide/self-hosting#alerts" title="Configure the alert runner" />

