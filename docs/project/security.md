# Security

What Linkyard defends against, how, and what it does not cover.

## Tenancy

Every user-reachable table carries `workspace_id`, `NOT NULL`, and every
repository function takes a workspace as its first argument. A query that forgets
it does not silently return more rows — it does not compile.

Three places where isolation had to be designed rather than inherited:

**The link cache** is keyed on `workspaceId + slug`. Keyed on slug alone, one
workspace's `pricing` would be served from another's cache entry.

**The password grant cookie** carries the workspace in its name and inside its
HMAC signature. Unlocking `acme.example.com/secret` does not unlock
`apple.example.com/secret`.

**Link updates** resolve and authorize in one statement. A separate read then
write leaves a window where the link can move between workspaces, which is the
shape of a time-of-check bug rather than a missing check.

## Sessions

Sealed JSON cookies, `httpOnly`, `sameSite=lax`, `secure` over HTTPS. No
server-side store, which is what keeps sign-in fast and stateless.

A sealed cookie cannot be deleted from the server, so revocation runs on a
version. Each session carries the `session_version` it was issued at, and the
value is compared on every request. Bumping the column on a user invalidates
every session that person holds, on every device, immediately.

The version is bumped on a password reset and on removal from a workspace.
Changing `NUXT_SESSION_PASSWORD` invalidates everything at once.

## Passwords

scrypt, through `nuxt-auth-utils`, for account passwords and for link
passwords. The plain value is never written.

Sign-in answers the same way for an unknown address as for a wrong password.
Password recovery answers the same way whether or not the address exists. Both
are deliberate — a shortener's sign-in form is otherwise a way to learn who
works somewhere.

Reset tokens are stored as hashes, expire, and are single-use. The token in the
email is never in the database.

## Destination validation

Destinations must be `http` or `https` with a hostname that looks real. Private
and local addresses are refused by default:

```text
127.0.0.0/8      loopback
10.0.0.0/8       private
172.16.0.0/12    private
192.168.0.0/16   private
169.254.0.0/16   link-local, cloud metadata
::1, fc00::/7    IPv6 loopback and unique-local
localhost, *.local
```

A shortener that accepts `http://169.254.169.254/` is a request-forgery tool
aimed at your own cloud metadata service, published on a URL anybody can click.

`NUXT_ALLOW_PRIVATE_DESTINATIONS=true` lifts the restriction for development.
Leave it off in production.

A link cannot point at itself. A slug whose destination resolves back to the same
short link is refused, so there is no redirect loop to trip over.

## Rate limits

| Action | Default |
|---|---|
| Redirect | 120 / minute per client |
| Link password attempt | 10 / minute per client per link |
| Create link | 30 / hour per workspace |
| Update link | 60 / minute per workspace |
| Register | 5 / hour per client, 3 / hour per address |
| Password recovery | 5 / hour per client |
| Invitation | 30 / hour per workspace |
| Abuse report | 5 / hour per client |

Client keys are a salted hash of the IP address with a salt generated per
process, so the counters do not hold addresses either.

::: warning Counted per process
Several instances mean several independent counters. This is the one part of
the design that does not survive horizontal scaling; run a single instance until
a shared store is wired in.
:::

## Uploads

Workspace logos are validated by their bytes, not by the name or the declared
content type. Size is capped and dimensions are bounded before anything is
written.

Storage keys are resolved against the root and checked before any write. An
absolute path, a `..` climb, a backslash, and a null byte are all refused, so a
key that reaches the disk cannot escape the upload directory.

## What is not covered

**No two-factor authentication.** Not built.

**No audit log for teams.** Security events are recorded for sign-in failures
and link changes, but there is no interface for reading them.

**No API tokens.** The HTTP API authenticates with the session cookie. There is
no separate credential to scope or revoke.

**Link passwords are not confidentiality.** They stop casual access. Anybody who
unlocks a link can pass the destination on.

**Rate limits are per instance.** Stated again because it is the one that bites
quietly.

## Reporting a problem

Open a security advisory on the GitHub repository rather than a public issue.
