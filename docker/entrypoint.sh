#!/bin/sh
# Sentry needs the source maps of the build it reads stack traces from. The
# maps ship inside the image, out of the public directory, and go to the
# operator's own Sentry when the container starts. One published image serves
# every operator, and the maps stay private.
set -eu

# The image carries its release name. An env_file that holds the variable
# with an empty value would replace an ENV of the image, so a file is used.
export SENTRY_RELEASE="${NUXT_PUBLIC_SENTRY_RELEASE:-$(cat .output/release 2>/dev/null || true)}"
export NUXT_PUBLIC_SENTRY_RELEASE="$SENTRY_RELEASE"

# The upload runs in the background. A slow or unreachable Sentry must not
# hold the server behind the health check, and a failed upload only costs
# readable stack traces.
if [ -n "${SENTRY_AUTH_TOKEN:-}" ] && [ -n "${SENTRY_ORG:-}" ] && [ -n "${SENTRY_PROJECT:-}" ]; then
  (
    sentry-cli releases new "$SENTRY_RELEASE" \
      && sentry-cli sourcemaps upload --quiet --release "$SENTRY_RELEASE" .output/public/_nuxt .output/sourcemaps \
      && sentry-cli releases finalize "$SENTRY_RELEASE" \
      && echo "[sentry] source maps uploaded for $SENTRY_RELEASE" \
      || echo "[sentry] source map upload failed, stack traces stay minified" >&2
  ) &
fi

# The server does not need the token, and a variable of the environment stays
# readable for the life of the container.
unset SENTRY_AUTH_TOKEN
exec "$@"
