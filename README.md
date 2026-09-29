# Paperless Better UI

Ein eigenes Frontend + Mobile-App für [Paperless-ngx](https://docs.paperless-ngx.com/).

**Ziel:** Dokumente mit dem Handy abfotografieren (oder E-Mails/Anhänge weiterleiten). Das System erkennt automatisch,
worum es geht (Typ, Korrespondent, Datum, Betrag, Tags) und legt es korrekt in Paperless ab. Man muss nur noch kurz bestätigen.

## Struktur

| Pfad | Zweck |
|---|---|
| `apps/web` | Web-Frontend (Dashboard, Review-Inbox, Suche) |
| `apps/mobile` | Handy-App: Kamera-Scan, Upload, schnelles Bestätigen |
| `services/api` | Backend/Gateway zwischen Apps und Paperless (Auth, Upload, Orchestrierung) |
| `services/ai-classifier` | KI-Erkennung: OCR-Text → Metadaten-Vorschläge |
| `services/mail-ingest` | E-Mails & Anhänge automatisch einlesen |
| `packages/shared-types` | Gemeinsame TypeScript-Typen (Dokument, Tag, Vorschlag …) |
| `packages/paperless-client` | Typisierter Client für die Paperless-ngx REST-API |
| `packages/ui` | Geteilte UI-Komponenten (Web + Mobile, falls sinnvoll) |
| `infra/` | Docker-Compose für lokales Paperless-ngx + Services |
| `docs/` | Architektur, Roadmap, Entscheidungen (ADRs) |
| `samples/` | Test-Dokumente & Test-Mails (keine echten privaten Daten!) |
| `scripts/` | Hilfsskripte (Seed, Setup, …) |

## Produktiv betreiben / Quickstart

Voraussetzung: Docker mit Compose-Plugin auf dem Server, auf dem auch Paperless laufen soll.

```bash
./scripts/setup.sh    # legt .env an, erzeugt API_AUTH_TOKEN, PAPERLESS_SECRET_KEY, Admin-Passwort
docker compose --env-file .env -f infra/docker-compose.yml up -d paperless
# http://localhost:8000 -> einloggen -> API-Token erzeugen -> in .env als PAPERLESS_API_TOKEN eintragen
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
# Optional Mail-Ingest (MAIL_IMAP_* in .env setzen): --profile mail
```

Web-UI danach auf `http://localhost:8080` (nginx reicht `/api` an den api-Container durch). Ports sind nur an
`127.0.0.1` gebunden: für Zugriff von außen einen TLS-Reverse-Proxy oder VPN davorsetzen. Web Push und
Kamera brauchen HTTPS. VAPID-Keys: `npx web-push generate-vapid-keys`. Backup: Volumes `api-data`,
`mail-data` sowie Paperless-Export (siehe [ADR 0003](docs/decisions/0003-backup-export-strategy.md)).
Hintergrund und Token-Handling: [ADR 0004](docs/decisions/0004-deployment.md).

Details: [docs/architecture.md](docs/architecture.md) · [docs/roadmap.md](docs/roadmap.md) · [docs/decisions/](docs/decisions/)
