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

Details: [docs/architecture.md](docs/architecture.md) · [docs/roadmap.md](docs/roadmap.md) · [docs/decisions/](docs/decisions/)
