# 0001 – Tech-Stack

**Status:** entschieden (2026-09-28)

## Zu entscheiden
| Bereich | Optionen |
|---|---|
| Monorepo-Tooling | pnpm workspaces · Turborepo · Nx |
| Web | Next.js · Vite + React · SvelteKit |
| Mobile | Expo (React Native) · Flutter · PWA |
| Backend | Node (Fastify/Hono) · Python (FastAPI) |
| KI | Claude API · OpenAI · lokal (Ollama) |
| DB für Vorschläge | SQLite · Postgres · keine (nur Paperless) |

## Vorläufige Tendenz
TypeScript überall (pnpm + Turborepo, Vite/React oder Next.js, Expo, Fastify/Hono) → Typen zwischen Web, Mobile und Backend teilbar.

## Entscheidung
TypeScript überall, wie in der vorläufigen Tendenz skizziert:

| Bereich | Wahl | Begründung |
|---|---|---|
| Monorepo-Tooling | pnpm workspaces + Turborepo | Ein Repo für Web/Mobile/Backend, geteilte Typen, schnelle inkrementelle Builds |
| Web | Vite + React (TS) | Schlanker als Next.js für ein Dashboard/Review-Inbox ohne SSR-Bedarf |
| Mobile | Expo (React Native) | Kamera/Upload/Push ohne natives Tooling pflegen zu müssen; folgt erst in Phase 3 |
| Backend | Node + Fastify (TS) | Leichtgewichtig, typsicher, teilt Typen mit Web via `packages/shared-types` |
| KI | Claude API (Anthropic) | `AI_PROVIDER` bleibt konfigurierbar/austauschbar (`services/ai-classifier` kapselt den Provider) |
| DB für Vorschläge | keine eigene DB (vorerst) | Vorschläge liegen bis zur Bestätigung im Speicher/Request-Kontext von `services/api`; Persistenz-Frage bleibt in `docs/architecture.md` offen, falls später doch nötig |

> **Update 2026-10-06:** Für Android gilt jetzt Capacitor um `apps/web`, siehe [0008](0008-android-app-mit-capacitor.md). `apps/mobile` (Expo) bleibt bestehen, wird aber nicht weiter ausgebaut.

## Konsequenzen
- Node 20 LTS, pnpm als Package-Manager (siehe `packageManager` in der Root-`package.json`).
- `packages/shared-types` und `packages/paperless-client` werden zuerst gebaut (Phase 1), `apps/mobile` erst in Phase 3.
- Lokales Paperless-ngx läuft via `infra/paperless/docker-compose.yml` (Redis + Webserver, SQLite-Backend – kein Postgres nötig für Dev).
