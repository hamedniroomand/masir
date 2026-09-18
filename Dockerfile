# syntax=docker/dockerfile:1
FROM oven/bun:1 AS build
WORKDIR /app
# Present at build so the Sentry module can turn itself on. Not copied into
# the runtime image; runtime still reads these from the process environment.
ARG NUXT_PUBLIC_SENTRY_DSN
ARG NUXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
ARG NUXT_PUBLIC_SENTRY_RELEASE
ARG SENTRY_DSN
ARG SENTRY_ENVIRONMENT
ARG SENTRY_RELEASE
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_URL
ENV NUXT_PUBLIC_SENTRY_DSN=$NUXT_PUBLIC_SENTRY_DSN
ENV NUXT_PUBLIC_SENTRY_ENVIRONMENT=$NUXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=$NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
ENV NUXT_PUBLIC_SENTRY_RELEASE=$NUXT_PUBLIC_SENTRY_RELEASE
ENV SENTRY_DSN=$SENTRY_DSN
ENV SENTRY_ENVIRONMENT=$SENTRY_ENVIRONMENT
ENV SENTRY_RELEASE=$SENTRY_RELEASE
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ENV SENTRY_URL=$SENTRY_URL
COPY package.json bun.lock bunfig.toml ./
COPY docs/package.json ./docs/
# --filter keeps the docs site's toolchain out of the app image.
RUN bun install --frozen-lockfile --filter masir
COPY . .
# The token is a build secret, not an ARG. An ARG would stay in the layer
# history and the build cache.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" bun run build
# The runtime image has no source or node_modules, so the operator scripts
# ship as bundles next to the server.
RUN bun build scripts/migrate.ts scripts/seed-admin.ts --target bun --outdir .output/scripts

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /app/.output ./.output
COPY --from=build --chown=bun:bun /app/drizzle ./drizzle
# Keeps `bun run db:migrate` and `bun run db:seed:admin` working inside the
# container, as the docs say.
COPY <<EOF package.json
{"scripts":{"db:migrate":"bun .output/scripts/migrate.js","db:seed:admin":"bun .output/scripts/seed-admin.js"}}
EOF
RUN mkdir -p data/uploads && chown bun:bun data/uploads

USER bun
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
