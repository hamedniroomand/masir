# Technical reference

> Use these pages when you need an exact name, value, route, or constraint.

Guides explain a task. Reference pages describe the interface that the task
uses.

<CardGroup :cols="2">

<Card title="Environment variables" icon="settings" to="/reference/environment">

Runtime, deployment, provider, security, and Compose settings with defaults.

</Card>

<Card title="HTTP API" icon="braces" to="/reference/api">

Session authentication, route methods, permissions, inputs, and status
behavior.

</Card>

<Card title="Scripts" icon="terminal" to="/reference/scripts">

Build, test, database, browser, and documentation commands.

</Card>

<Card title="Data model" icon="database" to="/reference/data-model">

Tables, tenant boundaries, key constraints, analytics retention, and
migrations.

</Card>

<Card title="Compatibility policy" icon="shield-check" to="/project/compatibility">

What a compatible upgrade preserves and how releases carry change.

</Card>

</CardGroup>

## Runtime naming

Nuxt maps `NUXT_*` variables to runtime configuration. Nested keys use
underscores. For example, `NUXT_MAIL_SMTP_HOST` becomes
`runtimeConfig.mail.smtp.host`.

Only `NUXT_PUBLIC_*` values reach the browser. All other runtime values stay
on the server.

The published container reads runtime values when it starts. You can use the
same image in several environments.

