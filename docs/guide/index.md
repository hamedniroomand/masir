# Get started

> Choose how you want to run Masir, then publish a working link.

Masir is a Bun application with a Postgres database. The deployment method
changes how you start it. It does not change the product.

## Choose an install path

<CardGroup :cols="3">

<Card title="Published image" icon="package" to="/guide/installation#published-docker-image">

Recommended for production. Pull a release image and run it with the included
Postgres stack.

</Card>

<Card title="Build the image" icon="hammer" to="/guide/installation#build-the-image">

Use this when you maintain a fork or need a change that is not in a release.

</Card>

<Card title="Run from source" icon="terminal" to="/guide/installation#run-from-source">

Use this for local development or a host where you manage Bun and Postgres.

</Card>

</CardGroup>

All paths need Postgres 18 or newer. Production also needs a domain and HTTPS.

## The shortest path

On a Linux server, the installer creates a `masir` directory, downloads the
published Compose stack, generates secrets, and starts Masir.

```sh
curl -fsSL https://raw.githubusercontent.com/hamedniroomand/masir/main/scripts/install.sh | sh
```

The script asks for the public origin, such as `https://go.example.com`.

## What success looks like

After installation:

1. `GET /api/health` reports that the app and database are ready.
2. The seed command creates the first owner account and workspace.
3. You can sign in and create a short link.
4. Opening the short URL returns a `302` to its destination.

## Continue

<CardGroup :cols="2">

<Card title="Install Masir" icon="package" to="/guide/installation">

Configure a production stack and verify it.

</Card>

<Card title="Create your first link" icon="rocket" to="/guide/quickstart">

Learn the main workflow after the server is ready.

</Card>

</CardGroup>

