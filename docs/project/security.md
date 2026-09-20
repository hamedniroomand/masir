# Security model

> Masir protects tenant data, account credentials, redirect inputs, and service capacity.

Self-hosting still leaves the operating system, proxy, database, backups, and
external providers under the operator's control.

## Tenant isolation

User-reachable product data is scoped by workspace. Repository operations take
the workspace ID before the resource ID.

The link cache key contains both workspace and slug. Password-grant cookies
also contain workspace identity. A resource outside the current workspace
returns `404`, not `403`.

The database enforces one owner per workspace and workspace-scoped slug
uniqueness.

## Sessions and CSRF

Sessions are sealed, HTTP-only, SameSite Lax cookies. Secure cookies are the
production default.

Each session carries the user's session version. Password reset increments the
database version and invalidates every existing session.

A state-changing browser request with an Origin that does not match the Host is
rejected. Non-browser clients can omit Origin.

## Passwords and tokens

Account and link passwords use Argon2id through `Bun.password`. Plain values
are not stored.

Sign-in uses the same visible result for an unknown account and a wrong
password. Password recovery also returns a neutral result.

Verification and reset tokens are stored as SHA-256 hashes. They expire and
work once.

## Destination validation

Destinations must use HTTP or HTTPS. Masir blocks loopback, private, link-local,
cloud metadata, `localhost`, and `.local` hosts by default.

`NUXT_ALLOW_PRIVATE_DESTINATIONS=true` lifts the restriction for an internal
deployment. Keep it off on a public service.

A link cannot target itself.

## Rate limits

Masir limits sign-in, registration, recovery, verification resend, redirects,
link passwords, link creates, link updates, slug checks, workspace creation,
invitations, demo creation, and abuse reports.

Client counters use a salted address hash instead of the raw address.

Protected actions fail closed when a configured shared Redis store is
unavailable. Redirects continue to serve so a Redis outage does not stop every
public link.

## Uploads

Masir inspects image bytes. PNG, JPEG, GIF, and WebP are accepted. SVG is
rejected because it can contain script.

The maximum size is checked before storage. Storage keys reject absolute paths,
parent traversal, backslashes, and null bytes.

Only a workspace owner can set or remove its logo.

## Visitor privacy

Click events do not store raw IP addresses or full user-agent strings. The
daily visitor hash cannot identify a visitor across links or days.

Country data comes from a configured trusted proxy header. The operator must
prevent a client from supplying that header.

## Abuse reports

The public report form records the slug and reason in the audit log. It always
returns a neutral acknowledgement so it cannot probe link state.

## Known limits

- Masir has no two-factor authentication.
- The HTTP API uses a full user session. It has no scoped API tokens.
- Anyone who receives a protected link destination can share that destination.
- A self-hosted operator can access the database and service logs.
- Masir does not manage host patches, network policy, or backup encryption.

## Report a vulnerability

Open a private security advisory in the GitHub repository. Do not include
exploit details, tokens, private URLs, or user data in a public issue.

