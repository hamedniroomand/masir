# Reference

Exact values, in tables. When a guide page tells you what to do, these pages
tell you the precise name, default, and shape.

<CardGroup :cols="2">

<Card title="Environment variables" icon="settings" to="/reference/environment">

Every variable, its default, and when it is required.

</Card>

<Card title="HTTP API" icon="braces" to="/reference/api">

Every route the interface uses, and how to call it yourself.

</Card>

<Card title="Scripts" icon="terminal" to="/reference/scripts">

The commands in `package.json` and what each one does.

</Card>

<Card title="Data model" icon="database" to="/reference/data-model">

Tables, keys, and the constraints that hold tenancy together.

</Card>

</CardGroup>

## How variables are named

Every server variable starts with `NUXT_`, which is how Nuxt maps it onto
runtime configuration. `NUXT_DATABASE_URL` becomes `runtimeConfig.databaseUrl`.
A nested key uses another underscore, so `NUXT_MAIL_SMTP_HOST` becomes
`runtimeConfig.mail.smtp.host`.

Only `NUXT_PUBLIC_*` variables reach the browser. Everything else stays on the
server.

Values are read at **runtime**, not at build time. The same container image
runs in staging and production with different environments, and nothing is
baked in. The one exception is Sentry, whose module is compiled in only when
one of its variables is set at build.
