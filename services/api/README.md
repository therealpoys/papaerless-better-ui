# services/api – Backend / Gateway

Einziger Service, der mit Paperless-ngx spricht.

- Auth für Web + Mobile
- Upload entgegennehmen → an Paperless (`/api/documents/post_document/`) weiterreichen
- Task-Status von Paperless verfolgen (`/api/tasks/`)
- Nach OCR: `ai-classifier` aufrufen, Vorschläge speichern
- Bestätigte Vorschläge als Metadaten in Paperless schreiben
- Liefert Daten für Review-Inbox, Suche, Dashboard

## Betrieb & Härtung

- **Auth**: `API_AUTH_TOKEN` gesetzt → alle `/api/*` brauchen `Authorization: Bearer <token>`
  (zeitkonstanter Vergleich, 401 `{"error":"Unauthorized"}`). `/health` bleibt offen.
- **Bind**: `API_HOST` (Default `0.0.0.0`). Ohne Token und nicht auf localhost → Warnung beim Start.
- **CORS**: `CORS_ORIGIN` (kommagetrennt); leer = alle Origins (nur Dev).
- **Rate-Limit**: `RATE_LIMIT_MAX` (600) pro `RATE_LIMIT_WINDOW_MS` (60000) und IP. Security-Header via helmet.
- **Upload**: `MAX_UPLOAD_MB` (Default 50), größere Dateien → 413.
- **Paperless-Zugriff**: Timeout `PAPERLESS_TIMEOUT_MS` (15000); GETs werden bei Netzwerkfehler/502/503/504
  bis zu 2x mit Backoff wiederholt. Paperless-Fehler erscheinen als `502 {"error","message"}`,
  Details nur im Server-Log.
- **`GET /health`**: `{status, paperless: "ok"|"unreachable", aiEnabled}`; HTTP 503 wenn Paperless
  nicht erreichbar. Ohne Auth.
- **Konfiguration**: fehlende/ungültige Variablen werden gesammelt gemeldet (Exit 1).
- **Shutdown**: SIGTERM/SIGINT stoppen den Reminder-Notifier und rufen `app.close()` auf.
- Start: `pnpm dev` bzw. `tsx src/server.ts` (die Workspace-Pakete sind TS-Quellen, `node dist/server.js`
  läuft ohne Loader nicht).
