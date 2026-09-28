# CLAUDE.md

Kontext für KI-gestützte Coding-Sessions in diesem Repo.

## Projekt
Eigenes Frontend + Mobile-App für Paperless-ngx. Kern-Flow:
Foto/Mail → Upload → Paperless OCR → KI schlägt Metadaten vor → User bestätigt → gespeichert.

## Regeln
- Paperless-ngx bleibt die "Source of Truth" für Dokumente. Wir speichern keine Dokumente doppelt.
- Paperless-API-Token nur im Backend (`services/api`), nie in den Apps.
- Secrets nur über `.env` (Vorlage: `.env.example`), nie committen.
- Keine echten privaten Dokumente in `samples/`.
- Offene Architektur-Entscheidungen stehen in `docs/decisions/` – bei Festlegung dort ein ADR ergänzen.

## Tech-Stack
Noch offen, siehe [docs/decisions/0001-tech-stack.md](docs/decisions/0001-tech-stack.md).

## Befehle
_(werden ergänzt, sobald der Stack steht)_
