#!/usr/bin/env sh
# Stops a browser test server left by an earlier run. A new build writes new
# asset hashes. A reused server still points at the old ones, so every asset
# answers 500 and the page never starts. Ports match PORTS in
# test/browser/scenario.ts, including the MASIR_TEST_SLOT offset. CI always
# starts fresh, and a machine without lsof must stop the old servers by hand.
set -eu
if [ -n "${CI:-}" ] || ! command -v lsof >/dev/null 2>&1; then
  exit 0
fi
slot=${MASIR_TEST_SLOT:-0}
for base in 3101 3102 3103; do
  port=$((base + slot * 10))
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  [ -n "$pids" ] || continue
  kill $pids 2>/dev/null || true
  # Wait for the port, because Playwright binds it straight after.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    lsof -ti tcp:"$port" >/dev/null 2>&1 || break
    sleep 0.2
  done
done
