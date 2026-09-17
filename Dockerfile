FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY docs/package.json ./docs/
# --filter keeps the docs site's toolchain out of the app image.
RUN bun install --frozen-lockfile --filter masir
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /app/.output ./.output
# The base image ships this user. Serving as root gives a container escape one
# less step to take.
USER bun
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
