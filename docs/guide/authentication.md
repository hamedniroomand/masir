# Signing in

Masir supports email and password, Google, and Microsoft. One person can use
all three for the same account.

## Email and password

Registration asks for an email and a password of at least 8 characters with at
least one number and one symbol. The form shows the rules as you type. Masir
then sends a verification link that works once and expires after 24 hours.

Verification gates workspace work, not sign-in. An unverified user can sign in
and is told to verify. They cannot create a workspace or accept an invitation
until they do.

Responses never reveal whether an address is registered. Signing up with an
existing email gets the same answer as a new one, and password recovery always
says:

> If an account exists for this email, we sent a recovery link.

A shortener's sign-up form would otherwise be a convenient way to check whether
an address belongs to your company.

### Recovery signs out every device

Resetting a password ends **every** session for that account, not only the
browser that did the reset.

Each account carries a session version. Sessions are sealed into a cookie with
that number inside, and the server compares it on every request. A reset
increments the column, so every cookie issued before it stops working at once,
on every device, including one a thief is holding.

## Google and Microsoft

Both run through `nuxt-auth-utils`, which validates the OAuth state on the
callback. A provider's button appears only when that provider has a client id
configured. An instance with no Google credentials does not offer Google.

Register these redirect URIs with the provider. They must match exactly,
including protocol and port:

```text
https://go.example.com/api/auth/google
https://go.example.com/api/auth/microsoft
```

::: warning localhost and 127.0.0.1 are different origins
If you registered `http://localhost:3000/api/auth/google`, browse to
`localhost`, not to the IP.
:::

Set `NUXT_OAUTH_MICROSOFT_TENANT` to your tenant id to accept one organisation
only. The default `common` accepts any Microsoft account.

## Linking accounts

Signing in with Google using an address that already has a password account
links the two, but only when **both sides** have proved the address: the
provider asserts it, and the local account is already verified.

If the local account is unverified, the accounts stay separate and you are
asked to sign in with your password first. Linking on an unproven email would
be a takeover path: claim an address with a provider, inherit somebody else's
workspace.

Google reports whether it verified an address. Microsoft does not, and Masir
treats a Microsoft identity as verified because the tenant owns the mailbox.

## Connected methods

**Settings → Account** lists the sign-in methods on your account and lets you
connect or disconnect them. You cannot disconnect the last one. The API refuses
with a `422`, because the alternative is an account nobody can sign into again.

## Bot protection

Set `NUXT_PUBLIC_TURNSTILE_SITE_KEY` and `NUXT_TURNSTILE_SECRET_KEY` and the
email sign-in and sign-up forms show a Cloudflare Turnstile check. The server
accepts a submit only after Cloudflare confirms the token. The OAuth buttons
never show the check.

## Registration

`NUXT_ALLOW_REGISTRATION` is `false` by default. With it off, the login page
hides the sign-up link and the register page sends people to login.

Keep it off on a single-workspace instance. Someone who registers there can
neither join your workspace without an invitation nor create a second one, so
they land on an empty page. Invite people instead. In multi-workspace mode,
turn it on so people can create their own workspace.

## Sending email

Verification, password recovery, and invitations all go out by email. Two
providers are built in.

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

Configure one of them. With `NUXT_MAIL_DRIVER` empty, SMTP wins if a host is
set, then Resend if a key is set. Name a driver to pin it:

```sh [.env]
NUXT_MAIL_DRIVER=resend
```

With neither configured, messages are written to the application log instead
of sent, including the links inside them. That is fine for a one-person
instance where you seed the admin and never invite anybody. For anything else,
invitations and password recovery stop working until you configure a provider.

### Email in development

The development stack starts [Mailpit](https://mailpit.axllent.org/), and every
message lands in a web inbox at `http://localhost:8025`. Nothing leaves the
machine. If you run the app on the host instead of in Compose:

```sh [.env]
NUXT_MAIL_SMTP_HOST=127.0.0.1
NUXT_MAIL_SMTP_PORT=1025
```
