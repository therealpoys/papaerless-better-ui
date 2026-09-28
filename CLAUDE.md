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

## Arbeitsweise mit Claude Code
- Bei größeren oder mehrteiligen Aufträgen: Aufgabe in unabhängige Teilaufgaben zerlegen und dafür mehrere Subagents parallel (in einer Nachricht, `run_in_background`) starten, statt alles seriell selbst abzuarbeiten.
- Teilaufgaben, die an denselben Dateien arbeiten könnten, bekommen `isolation: "worktree"`, damit sich die Subagents nicht gegenseitig überschreiben; die Ergebnisse werden danach zusammengeführt.
- Bei kleinen, klar abgegrenzten Einzelaufgaben (eine Datei, ein Bugfix) ist die Aufteilung in Subagents nicht nötig – hier normal direkt arbeiten.

## Tech-Stack
Noch offen, siehe [docs/decisions/0001-tech-stack.md](docs/decisions/0001-tech-stack.md).

## Befehle
- `pnpm install` – Dependencies installieren
- `pnpm dev` – alle Apps/Services im Dev-Modus (Turborepo), u.a. `services/api` auf :3001 und `apps/web` auf :5173
- `pnpm typecheck` / `pnpm build` / `pnpm lint` – über alle Packages
- `docker compose -f infra/paperless/docker-compose.yml up -d` – lokales Paperless-ngx auf :8000 starten
