# Accounts and sign-in

> Choose how users authenticate and how Masir delivers account messages.

Users sign in with an email address and a password. Masir has no public
registration.

## Create the first owner

The first owner comes from the seed script. Set `ADMIN_EMAIL` and
`ADMIN_PASSWORD`, then run:

```sh
bun run db:seed:admin
```

Change the password with **Forgot password** on the sign-in page.

## Add other users

The owner invites each user by email. The invite link creates the account. The
invited person sets a password on the invite page and joins the workspace.

A person who already has an account signs in first. Masir then returns them to
the invitation.

A signed-in user who is not a member of the workspace sees the no-access page.

<ReadMore to="/guide/members#invite-a-person" title="Read the invite flow" />

## Passwords

Passwords use Argon2id through `Bun.password`.

## Recover an account

The forgot-password route always returns the same result, whether the address
exists or not.

A reset link is single-use and expires. Completing the reset increases the
account session version and signs out every device.

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
