# syntax=docker/dockerfile:1
FROM oven/bun:1 AS build
WORKDIR /app
# Compiles the Sentry module in. It stays off until a DSN is set at run time.
ENV SENTRY_BUILD=true
COPY package.json bun.lock bunfig.toml ./
COPY docs/package.json ./docs/
# --filter keeps the docs site's toolchain out of the app image.
RUN bun install --frozen-lockfile --filter masir
COPY . .
RUN bun run build
# The release name that this image reports and uploads under. A file, because
# a compose env_file with an empty value replaces a variable of the image.
RUN bun -e "await Bun.write('.output/release', 'masir@' + (await Bun.file('package.json').json()).version)"
# The runtime image has no source or node_modules, so the operator scripts
# ship as bundles next to the server.
RUN bun build scripts/migrate.ts scripts/seed-admin.ts --target bun --outdir .output/scripts
# The image carries sentry-cli to upload the source maps when the container
# starts. It comes from the lockfile, so there is no download to verify and no
# second version to track.
RUN cp "$(bun -e "console.log(require('@sentry/cli').getPath())")" /usr/local/bin/sentry-cli

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /app/.output ./.output
COPY --from=build --chown=bun:bun /app/drizzle ./drizzle
COPY --from=build /usr/local/bin/sentry-cli /usr/local/bin/sentry-cli
COPY --chown=bun:bun docker/entrypoint.sh ./entrypoint.sh
# Keeps `bun run db:migrate` and `bun run db:seed:admin` working inside the
# container, as the docs say.
COPY <<EOF package.json
{"scripts":{"db:migrate":"bun .output/scripts/migrate.js","db:seed:admin":"bun .output/scripts/seed-admin.js"}}
EOF
RUN mkdir -p data/uploads && chown bun:bun data/uploads

USER bun
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", ".output/server/index.mjs"]
