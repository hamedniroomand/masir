# syntax=docker/dockerfile:1
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY docs/package.json ./docs/
# --filter keeps the docs site's toolchain out of the app image.
RUN bun install --frozen-lockfile --filter masir
COPY . .
RUN bun run build
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
