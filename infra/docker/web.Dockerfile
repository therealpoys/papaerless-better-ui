# syntax=docker/dockerfile:1
# apps/web als statischer Build hinter nginx (non-root). /api wird an den api-Container
# durchgereicht -> VITE_API_URL ist leer, das Frontend nutzt relative URLs.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY services/api/package.json services/api/
COPY services/ai-classifier/package.json services/ai-classifier/
COPY services/mail-ingest/package.json services/mail-ingest/
COPY packages/paperless-client/package.json packages/paperless-client/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter "@papaerless/web..."
COPY packages packages
COPY apps/web apps/web
# Leer = relative URLs (/api/...). Bewusst KEIN VITE_API_TOKEN: das Token würde im Bundle
# landen; nginx setzt den Authorization-Header stattdessen serverseitig (nginx.conf.template).
ENV VITE_API_URL=""
RUN pnpm --filter @papaerless/web build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
# *.template wird beim Start per envsubst nach /etc/nginx/conf.d/ gerendert
COPY infra/docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
# API_AUTH_TOKEN wird zur Laufzeit per compose übergeben (nie ins Image backen)
ENV API_UPSTREAM=http://api:3001
EXPOSE 8080
