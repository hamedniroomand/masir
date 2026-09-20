# Accounts and sign-in

> Choose how users authenticate and how Masir delivers account messages.

Masir supports email and password, Google, and Microsoft. One account can have
more than one connected identity.

## Email and password

Public registration is off by default. Set `NUXT_ALLOW_REGISTRATION=true` to
show the registration path.

A new password account receives a verification message. Workspace creation and
other protected actions require a verified address.

Passwords use Argon2id through `Bun.password`.

## Recover an account

The forgot-password route always returns the same result, whether the address
exists or not.

A reset link is single-use and expires. Completing the reset increases the
account session version and signs out every device.

## Add Google or Microsoft

Set the client ID and secret for a provider. Its button appears after the
server restarts.

OAuth redirects return to the root application origin. Add the callback shown
by your provider configuration.

In a self-hosted Microsoft deployment, the default tenant is `common`. In
cloud mode, Masir requires a specific tenant to prevent accounts from any
Microsoft tenant from linking by matching email.

## Connect identities

When an OAuth provider returns an address that already belongs to a local
account, Masir connects the provider to that account.

Users can review connected identities and disconnect one. Masir refuses to
remove the last sign-in method.

## Add bot protection

Set both Cloudflare Turnstile keys to protect email sign-in, registration, and
the public demo action.

The site key reaches the browser. Keep the secret key on the server. OAuth
buttons do not use Turnstile.

If Cloudflare cannot verify a challenge, Masir rejects the request.

## Configure email

Masir can send through SMTP or Resend.

When `NUXT_MAIL_DRIVER` is empty, Masir tries:

1. SMTP when a host is set
2. Resend when an API key is set
3. the application log

The log driver keeps development usable without an email service. It writes
the message and action link to the server log.

Use Mailpit from `compose.dev.yaml` during local development. Open it at
`http://localhost:8025` by default.

<ReadMore to="/reference/environment#mail" title="See every mail setting" />

