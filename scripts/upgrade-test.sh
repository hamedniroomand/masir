#!/usr/bin/env sh
# Seeds a database with the previous tag, migrates it to HEAD, and boots HEAD
# against it. A migration that breaks on real rows fails here, not on an
# operator's instance.
set -eu
: "${NUXT_DATABASE_URL:?point NUXT_DATABASE_URL at a database you can lose}"

prev=$(git tag --sort=-v:refname --no-contains HEAD | head -1)
if [ -z "$prev" ]; then
  echo "no previous tag; nothing to upgrade from"
  exit 0
fi
echo "upgrading from $prev"

work=$(mktemp -d)
pid=
cleanup() {
  [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  git worktree remove --force "$work" 2>/dev/null || true
}
trap cleanup EXIT

git worktree add --detach "$work" "$prev"
(cd "$work" && bun install --frozen-lockfile --filter masir \
  && ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}" \
     ADMIN_PASSWORD="${ADMIN_PASSWORD:-upgrade-test-fixture}" bun run db:seed:admin)

bun run db:migrate
bun run build
bun .output/server/index.mjs &
pid=$!

for _ in $(seq 1 30); do
  if curl -fs "http://localhost:${PORT:-3000}/api/health"; then
    echo
    echo "upgrade from $prev ok"
    exit 0
  fi
  sleep 1
done
echo "server did not become healthy after upgrade from $prev"
exit 1
