#!/usr/bin/env sh
# Starts the compose Postgres for the tests and makes sure masir_test exists.
# CI and a machine without Docker bring their own Postgres, so this does
# nothing there.
set -eu
if [ -n "${CI:-}" ] || ! command -v docker >/dev/null 2>&1; then
  exit 0
fi
compose="docker compose -f compose.dev.yaml"
$compose up -d --wait db >/dev/null
# The init script runs on an empty volume only. An older volume needs the
# database made by hand, once.
if ! $compose exec -T db psql -U masir -d postgres -tAc "select 1 from pg_database where datname = 'masir_test'" | grep -q 1; then
  $compose exec -T db createdb -U masir masir_test
fi
