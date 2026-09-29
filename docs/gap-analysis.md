# Gap-Analyse: Was fehlt für den aktiven Einsatz? (2026-09-29)

Stand: alle Phasen 0–6 (bis auf Punkte unten) und 8 sind umgesetzt, `pnpm typecheck` läuft grün.
Funktional ist der Kern-Flow (Foto/Mail → Upload → OCR → KI-Vorschlag → Bestätigen) vorhanden.
Was fehlt, ist vor allem **Betriebsfähigkeit** und **Alltagskomfort**.

## Blocker für den Alltagsbetrieb
1. **Deployment** – kein Dockerfile für `api`/`mail-ingest`, kein Gesamt-Compose, kein Setup-Skript.
   Man kann das System nur per `pnpm dev` starten; nach Reboot/Absturz läuft nichts weiter.
2. **Keine Tests, keine CI** – kein Testrunner, `tests/`-Ordner leer, kein `.github/workflows`.
   Jede Änderung ist ungesichert.
3. **Backend-Härtung** – Token-Vergleich nicht zeitkonstant, kein Rate-Limit, keine Request-Timeouts/
   Retries gegen Paperless, `/health` prüft Paperless nicht, Start bricht ohne klare Meldung ab,
   `API_AUTH_TOKEN` ist optional und steht im Web-Bundle (`VITE_API_TOKEN`).
4. **Mobile kann keine Dokumente ansehen/suchen** – nur Scan → Upload → Bestätigen.

## Komfort / Qualität
5. **Suche & Discovery (Phase 7)** – aktive Filter-Chips, Debounce, Sortierung, Datums-Presets,
   Kombobox-Filter, gespeicherte Suchen. Aktuell rudimentär.
6. Usability-Test mit echten Nutzern (nicht automatisierbar).

## Umsetzung
Parallel in Subagents (je eigener Worktree):
| Strang | Inhalt |
|---|---|
| A | Testtooling (vitest) + Tests für api/mail-ingest/ai-classifier + GitHub-Actions-CI |
| B | Deployment: Dockerfiles, Gesamt-Compose, ADR 0004, Setup-Doku/-Skript |
| C | Backend-Härtung (`services/api`) |
| D | Mobile: Dokumentliste, Suche, Detail |
| E | Web Phase 7 (Suche & Discovery) |
