# syntax = docker/dockerfile:1

ARG BUN_VERSION=1.3.8
FROM oven/bun:${BUN_VERSION}-slim AS base

LABEL fly_launch_runtime="Bun"

WORKDIR /app

ENV NODE_ENV="production"


FROM base AS build

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build


FROM base AS final

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /app/build /app/build
COPY --from=build /app/public /app/public

RUN mkdir -p /data && chown -R 1000:1000 /app /data
VOLUME /data

USER 1000:1000

EXPOSE 3000
ENV DATABASE_URL="file:///data/sqlite.db"
CMD [ "bun", "run", "start" ]
