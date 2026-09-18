# Security

What Masir defends against, how, and what it leaves to you.

## Tenancy

Every user-reachable table carries a `NOT NULL` `workspace_id`, and every
repository function takes a workspace as its first argument. A query that
forgets it does not compile.

Three places where isolation had to be designed rather than inherited:

- **The link cache** is keyed on workspace plus slug. Keyed on the slug alone,
  one workspace's `pricing` would be served from another's cache entry.
- **The password unlock cookie** carries the workspace in its name and inside
  its signature. Unlocking `acme.example.com/secret` does not unlock
  `apple.example.com/secret`.
- **Link updates** resolve and authorise in one statement. A separate read then
  write leaves a window in which the link could move between workspaces.

A request for something outside your workspaces answers `404`, never `403`, so
the response does not confirm that the thing exists.

## Sessions

Sealed JSON cookies, `httpOnly`, `SameSite=Lax`, `Secure` over HTTPS. There is
no server-side store, which keeps sign-in fast and stateless.

A sealed cookie cannot be deleted from the server, so revocation works on a
version. Each session carries the `session_version` it was issued at, and the
value is compared on every request. Bumping the column on a user invalidates
every session that person holds, on every device, at once. A password reset
bumps it. Changing `NUXT_SESSION_PASSWORD` invalidates everything.

A state-changing request whose `Origin` header does not match the `Host` is
refused with `403`. A request without an `Origin`, which is what non-browser
clients send, is accepted, since browsers always send one on a cross-site
request.

## Passwords

**argon2id** through `Bun.password`, for account passwords and link passwords
alike. The plain value is never written.

The cost is the one Bun picks: 64 MiB of memory, 2 iterations, 1 lane. That is
above the OWASP floor, so no parameters are passed. Every hash carries its own
salt and names its algorithm, so a future change can verify old hashes and
rewrite them on the next sign-in.

A stored hash that cannot be read counts as a failed check, not a server error.

Sign-in answers the same way for an unknown address as for a wrong password,
and password recovery answers the same way whether or not the address exists.
An address with no account is still checked against a dummy hash, so the two
paths take the same time.

Reset and verification tokens are stored as hashes, expire, and work once. The
token in the email is never in the database.

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

A link cannot point at itself, so there is no redirect loop to trip over.

## Rate limits

| Action | Default |
|---|---|
| Sign in | 10 a minute per client **and** per address |
| Register | 5 an hour per client, 3 an hour per address |
| Password recovery | 5 an hour per client |
| Resend verification | 5 an hour per client |
| Redirect | 120 a minute per client |
| Link password attempt | 10 a minute per client per link |
| Create link | 30 an hour per workspace |
| Update link | 60 a minute per workspace |
| Slug availability check | 30 a minute per client |
| Create workspace | 5 a day per client |
| Invitation | 30 an hour per workspace |
| Abuse report | 5 an hour per client |

Client keys are a hash of the IP address with a salt generated per process, so
the counters do not hold addresses either.

The sign-in limit counts twice because the two stop different attacks: one
caller guessing many passwords, and many callers guessing one account. It also
bounds memory, since argon2id holds 64 MiB for the length of every check.

Counters live in the process unless `NUXT_REDIS_URL` is set. Several instances
without a shared store mean several independent counters. When the shared
store is unreachable, protected routes refuse and the redirect path keeps
serving.

## Uploads

Workspace logos are validated by their bytes, not by the file name or the
declared content type. PNG, JPEG, GIF, and WebP pass. SVG is refused because it
can hold script. Size is capped at `NUXT_STORAGE_MAX_UPLOAD_BYTES` before
anything is written. Only an owner can set or remove a logo.

Storage keys are resolved against the upload root and checked before any
write. An absolute path, a `..` climb, a backslash, and a null byte are all
refused.

## Abuse reports

Anyone can report a link at `/report` without an account. The report is written
to the audit log with the slug and the reason. The form always acknowledges,
even when rate limited, so it cannot be used to probe.

## What is not covered

- **No two-factor authentication.**
- **No API tokens.** The HTTP API authenticates with the session cookie. There
  is no separate credential to scope or revoke.
- **No interface for the audit log.** Events are recorded and readable over
  the API by the owner. There is no page for them yet.
- **Link passwords are not confidentiality.** Anyone who unlocks a link can
  pass the destination on.

## Reporting a problem

Open a security advisory on the GitHub repository rather than a public issue.
