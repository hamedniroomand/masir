# Reference

Exact values, in tables.

<CardGroup :cols="3">

<Card title="Environment" icon="settings" to="/reference/environment">

Every variable, its default, and when it is required.

</Card>

<Card title="Scripts" icon="terminal" to="/reference/scripts">

The commands in `package.json` and what each one does.

</Card>

<Card title="Data model" icon="database" to="/reference/data-model">

Tables, keys, and the constraints that hold tenancy together.

</Card>

</CardGroup>

## Conventions

Every server variable is prefixed `NUXT_`, which is how Nuxt maps it onto
runtime configuration. `NUXT_DATABASE_URL` becomes `runtimeConfig.databaseUrl`;
a nested key uses another underscore, so `NUXT_MAIL_SMTP_HOST` becomes
`runtimeConfig.mail.smtp.host`.

Only `NUXT_PUBLIC_*` reaches the browser. Everything else stays on the server.

Values are read at **runtime**, not at build time. The same container image runs
in staging and production with different environments, and nothing is baked in.
