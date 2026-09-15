FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
VOLUME /data
ENV NUXT_DATABASE_URL=file:/data/linkyard.db
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
