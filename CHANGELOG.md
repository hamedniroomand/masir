# Changelog

All notable changes to Masir are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

A release that needs an action from you has an **Upgrade notes** block. Read
the notes for every version between the one you run and the one you install.

## [Unreleased]

## [1.0.1] - 2026-09-20

### Fixed

- Compose hands `POSTGRES_PASSWORD` to the app as `PGPASSWORD`, outside the
  connection string. A password with `%` or another URL character no longer
  stops the app at boot with `URIError`. Any character works now, except `$`,
  which `.env` needs as `$$`.
- Google Analytics hits go to Google directly. The first-party proxy answered
  `500` on every hit, because Bun's `undici` has no `Agent.close()`.

## [1.0.0] - 2026-09-20

First release.
