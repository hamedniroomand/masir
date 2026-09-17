# Signing in

Masir supports email and password, Google, and Microsoft. One person can use
all three for the same account.

## Email and password

Registration collects an email and a password of at least 12 characters, then
sends a verification link that works once and expires after 24 hours.

Verification gates workspace work, not sign-in. An unverified user can log in
and see that they need to verify; they cannot create a workspace or accept an
invitation until they have.

Responses never reveal whether an address is registered. Signing up with an
existing email returns the same `{ ok: true }` as a new one, and password
recovery always answers:

> If an account exists for this email, we sent a recovery link.

That is deliberate. A shortener's sign-up form is otherwise a convenient way to
test whether an address belongs to your company.

### Recovery ends every session

Resetting a password invalidates **every** session for that account, not just
the browser that did the reset.

Each account carries a `session_version`. Sessions are sealed into a cookie with
that number inside; the server compares it on each request. A reset increments
the column, so every cookie issued before it stops working immediately — on
every device, including one a thief is holding.

## Google and Microsoft

Both run through `nuxt-auth-utils`, which validates OAuth state on the callback.

A provider's button appears only when that provider has a client ID configured,
so an instance with no Google credentials simply does not offer Google.

Set up redirect URIs to match exactly, including protocol and port:

```text
https://go.example.com/api/auth/google
https://go.example.com/api/auth/microsoft
```

::: warning Localhost is not 127.0.0.1
Providers treat them as different origins. If you registered
`http://localhost:3000/api/auth/google`, you must browse to `localhost`, not to
the IP.
:::

## Linking accounts

Signing in with Google using an address that already has a password account
links the two, but only when **both sides** have proved the address: the
provider asserts it, and the local account is already verified.

If the local account is unverified, the accounts stay separate and you are told
to sign in with your password first. Linking on an unproven email would be a
takeover path — claim an address with a provider, inherit somebody else's
workspace.

Google reports whether it verified an address. Microsoft does not, and Masir
treats a Microsoft identity as verified because the tenant owns the mailbox.

## Connected methods

**Settings → Account** lists the sign-in methods on your account and lets you
connect or disconnect them.

You cannot disconnect the last one. The API refuses it with a `422`, because the
alternative is an account nobody can ever sign into again.

## Sending email

Masir needs an email provider for verification, recovery, and invitations.
Two are built in.

**SMTP**, for a relay you already run or a transactional service that offers
one:

```sh [.env]
NUXT_MAIL_SMTP_HOST=smtp.example.com
NUXT_MAIL_SMTP_PORT=587
NUXT_MAIL_SMTP_USER=masir
NUXT_MAIL_SMTP_PASSWORD=...
NUXT_MAIL_FROM=Masir <no-reply@example.com>
```

**[Resend](https://resend.com)**, which needs one key and no relay:

```sh [.env]
NUXT_MAIL_API_KEY=re_...
NUXT_MAIL_FROM=Masir <no-reply@example.com>
```

Configure one. With `NUXT_MAIL_DRIVER` empty, SMTP wins if a host is set, then
Resend if a key is set. Name a driver to pin it:

```sh [.env]
NUXT_MAIL_DRIVER=resend
```

With neither configured, messages go to the application log instead of being
sent. That is fine for a single-user instance where you seed the admin account
and never invite anybody, and useless for anything else — invitations and
password recovery both stop working.

For development, `docker compose up -d mail` starts Mailpit and every message
lands in a web inbox rather than a real one:

```sh [.env]
NUXT_MAIL_SMTP_HOST=localhost
NUXT_MAIL_SMTP_PORT=1025
```

Read what was sent at `http://localhost:8025`. Nothing leaves the machine.
