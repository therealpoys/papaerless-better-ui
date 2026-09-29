# syntax=docker/dockerfile:1
# Gemeinsames Dockerfile für services/api und services/mail-ingest.
#   docker build -f infra/docker/node-service.Dockerfile \
#     --build-arg SERVICE=api --build-arg ENTRY=server.ts -t papaerless-api .
#   (mail-ingest: SERVICE=mail-ingest, ENTRY=index.ts)
#
# Warum ein esbuild-Bundle statt `tsc` + node_modules? Die Workspace-Packages
# (paperless-client, shared-types, ai-classifier) zeigen mit "main" auf ihre .ts-Quellen und
# sind zur Laufzeit unter Node nicht direkt ausführbar. Das Bundle enthält nur, was wirklich
# importiert wird (= Prod-Abhängigkeiten, keine devDependencies); das Runtime-Image braucht
# weder node_modules noch pnpm.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS build
ARG SERVICE
ARG ENTRY
RUN test -n "$SERVICE" && test -n "$ENTRY"
RUN corepack enable && npm install -g esbuild@0.25
WORKDIR /repo
# Erst nur Manifeste -> Install-Layer bleibt gecacht, solange sich Dependencies nicht ändern
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
    pnpm install --frozen-lockfile --filter "@papaerless/${SERVICE}..."
COPY packages packages
COPY services services
# Typecheck als Gate, dann bündeln
RUN pnpm --filter "@papaerless/${SERVICE}" exec tsc --noEmit
RUN esbuild "services/${SERVICE}/src/${ENTRY}" --bundle --platform=node --format=esm \
      --target=node22 --outfile=/out/dist/main.js \
      --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Persistente Laufzeitdaten liegen in /app/data (relativ zu dist/); das Volume erbt die Rechte von node
RUN mkdir -p /app/data && chown node:node /app/data
COPY --from=build --chown=node:node /out/dist ./dist
USER node
VOLUME ["/app/data"]
CMD ["node", "dist/main.js"]
