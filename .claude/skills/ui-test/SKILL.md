---
name: ui-test
description: Startet Paperless, API und Web-App und testet die Oberfläche im Browser mit dem Playwright-MCP. Nutzen nach jeder UI-Änderung oder wenn gesagt wird "teste die UI", "starte die App und prüf das".
---

# UI-Test mit Playwright-MCP

Der Playwright-MCP ist in `.mcp.json` eingetragen (headless, isolated). Nach dem ersten Öffnen des Repos muss der MCP-Server einmal freigegeben werden; Tools heißen `mcp__playwright__browser_*`. Fehlen sie, dem User sagen, dass Claude Code neu gestartet bzw. `/mcp` geprüft werden muss.

## 1. Anwendung starten

Prüfen, was schon läuft, und nur Fehlendes starten:

```bash
for p in 8000 3001 5173; do curl -s -o /dev/null -w "$p:%{http_code}\n" localhost:$p; done
```

- Paperless (:8000) fehlt: `docker compose -f infra/paperless/docker-compose.yml up -d`, dann warten bis :8000 antwortet (302/200).
- API (:3001) und Web (:5173) fehlen: im Hintergrund (`run_in_background`) starten, ohne die Mobile-App (Metro wird nicht gebraucht):
  `pnpm dev --filter=@papaerless/api --filter=@papaerless/web`
  Danach ca. 15 s warten; Web muss 200 liefern, API antwortet auf `/` mit 404 (normal).
- `.env` muss existieren (Vorlage `.env.example`). Mail-Ingest bleibt ohne IMAP-Daten inaktiv, das ist okay.

## 2. Im Browser testen

1. `browser_navigate` auf `http://localhost:5173`.
2. `browser_snapshot` (Accessibility-Tree) zum Orientieren; damit bedienen: `browser_click`, `browser_type`, `browser_press_key`, `browser_select_option`.
3. Die geänderte Oberfläche wirklich durchspielen, inkl. Fehlerfälle (leere Eingabe, unbekannter Name, Abbrechen). Zum Hochladen: `browser_file_upload` mit einer Datei aus `samples/` (keine echten privaten Dokumente).
4. `browser_take_screenshot` und das Bild ansehen; ein leerer Frame heißt: Start fehlgeschlagen.
5. `browser_console_messages` auf Fehler prüfen. Mobile Ansicht bei Layout-Änderungen mit `browser_resize` (z. B. 390x844) prüfen.

## 3. Aufräumen und Bericht

- Beim Test angelegte Testdaten (Schlagwörter, Dokumente) in Paperless wieder löschen, oder dem User sagen, was übrig ist.
- `browser_close` am Ende. Selbst gestartete Dev-Server nur beenden, wenn der User sie nicht weiter braucht.
- Bericht: was bedient wurde, was funktioniert hat, was nicht (mit Fehlertext). Nichts als "getestet" melden, was nicht wirklich angeklickt wurde.
