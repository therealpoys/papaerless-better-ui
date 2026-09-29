# Roadmap

## Phase 0 – Setup
- [x] Tech-Stack festlegen (ADR 0001)
- [x] Lokales Paperless-ngx via Docker
- [x] API-Token erzeugen, Verbindung testen

## Phase 1 – Web MVP
- [x] Paperless-Client (Dokumente, Tags, Korrespondenten, Typen)
- [x] Upload im Web
- [x] Dokumentliste + Detail
- [x] Suche & Filter (Tags, Korrespondent, Zeitraum)
- [x] Korrespondent, Dokumenttyp und Tags im Dokument-Detail neu **anlegen** können, nicht nur aus
      bestehender Liste auswählen. `services/api/src/routes/metadata.ts` hat jetzt POST-Routen für
      `/tags`, `/correspondents`, `/document-types` (nutzen die schon vorhandenen
      `paperless-client`-Methoden). Neue `Combobox`-Komponente in `packages/ui` (Freitext-Suche +
      "„…“ neu anlegen") ersetzt die `<select>`-Felder für Korrespondent/Dokumenttyp in
      `DocumentDetail.tsx`; der Tag-Picker hat ein Eingabefeld für neue Tags erhalten. Nach dem
      Anlegen ruft `App.tsx` (`reloadMetadata`) `listTags`/`listCorrespondents`/`listDocumentTypes`
      neu ab, sodass neue Werte sofort in `SearchFilter` auswählbar sind – per E2E-Test (Playwright)
      gegen den lokalen Dev-Server verifiziert.

## Phase 2 – Mobile App
- [x] Kamera-Scan mit Zuschnitt, Mehrseiten → PDF
- [x] Upload-Queue (offline-fähig)
- [x] Schnelles Bestätigen

## Phase 3 – E-Mail
- [x] Paperless Mail-Regeln testen (siehe `docs/decisions/0002-mail-ingest.md`)
- [x] Eigener mail-ingest Service (`services/mail-ingest`)

## Phase 4 – Später
- [x] Erinnerungen (Fälligkeiten, Vertragskündigungen)
- [x] Push-Benachrichtigungen (Web Push + Expo Push)

## Optional – KI-Erkennung
Kein Teil des Kern-Flows; Paperless bleibt ohne KI voll nutzbar. Nur aktivieren, wenn
`AI_PROVIDER`/`AI_API_KEY` gesetzt sind (siehe `.env.example`).
- [x] Klassifizierung aus OCR-Text (`services/ai-classifier`)
- [x] Review-Inbox (Vorschläge bestätigen/korrigieren)

## Phase 5 – UX Design
Ziel: der Kern-Flow (Upload → OCR → KI-Vorschlag → Bestätigen) fühlt sich schnell und
selbsterklärend an.
- [x] User Flows für den Kern-Flow skizzieren (Upload, Review-Inbox, Suche) – Wireframes als
      Canvas-Artifact (13 Screens, 3 Flows) statt Figma – Link siehe Notiz unten
- [x] Design-Tokens definieren (Farben, Typografie, Spacing, Radius) als Basis für `packages/ui`
      – `packages/ui/src/tokens.ts` (plattformneutral) + `tokens.css` (Web, inkl. Dark Mode)
- [x] Gemeinsame Komponenten in `packages/ui` extrahieren (Button, TagChip, ConfidenceBadge,
      Card, Field, EmptyState, ErrorState, UploadProgress) statt Duplikation in `apps/web`;
      `apps/mobile` nutzt dieselben Farb-Tokens für Scan-/Crop-/Confirm-/Queue-Screens
- [x] Review-Inbox UX: Konfidenz als Badge mit Farbe + Label ("sicher/eher unsicher/unsicher")
      statt nackter Prozentzahl (Web + Mobile)
- [x] Upload-Flow: Fortschritt (Hochladen → OCR läuft → Fertig) sichtbar machen statt stillem Warten
- [x] Empty States definieren (keine Dokumente, keine Erinnerungen, leere Review-Inbox, kein
      Dokument ausgewählt) – `EmptyState`-Komponente
- [x] Error States definieren (Upload fehlgeschlagen, Speichern fehlgeschlagen, Laden
      fehlgeschlagen) mit Retry-Aktion – `ErrorState`-Komponente
- [x] Mobile-Scan-Flow: Seiten-Reihenfolge per ◀/▶ auf den Thumbnails änderbar, Seitenzahl
      sichtbar (`apps/mobile/src/screens/ScanScreen.tsx`)
- [x] Dark Mode – tokenbasiert über `prefers-color-scheme`, kein Toggle nötig
- [x] Barrierefreiheit: sichtbarer Fokus-Ring (`:focus-visible`), `aria-label`/`aria-current`
      auf Tabs, Filtern und Formularfeldern, Toggle-Chips mit `aria-pressed`,
      Dokumentliste als fokussierbare `<button>`-Elemente statt reinem `<li onClick>`
- [ ] Kurzer Usability-Test mit 2–3 echten Nutzern (eigene Dokumente durchgehen lassen),
      Ergebnisse hier als Follow-ups ergänzen – **kann nicht automatisiert ausgeführt werden**,
      braucht echte Test-Teilnehmer:innen

> Wireframes (Upload/Review-Inbox/Suche, 13 Screens):
> https://claude.ai/artifact/2Acm6mLqyQrSZnfzSnSC3T – privates Artifact, nur für den
> Ersteller-Account sichtbar, kein öffentlicher Link.

## Phase 6 – Produktionsreife
Ausgelöst durch einen Audit ("was fehlt für sinnvolle Nutzung"), der über UX hinaus prüfte, was
den Alltagseinsatz blockiert.
- [x] **API-Gateway absichern** – `services/api` hatte bisher keinerlei Auth, nur offenes CORS.
      Jetzt optionales Bearer-Token (`API_AUTH_TOKEN` in `.env`), geprüft in
      `services/api/src/auth.ts` für alle `/api/*`-Routen (`/health` bleibt offen). Ohne gesetztes
      Token bleibt das Backend wie bisher offen (lokale Entwicklung). `apps/web`
      (`VITE_API_TOKEN`) und `apps/mobile` (`EXPO_PUBLIC_API_TOKEN`) schicken das Token mit.
      Vorhandenes, bis dahin ungenutztes `API_JWT_SECRET` wurde zu `API_AUTH_TOKEN` migriert
      (Wert bleibt erhalten) – echtes Login/Multi-User-Auth ist das noch nicht, nur ein geteiltes
      Geräte-Passwort. Reicht für Familien-/Einzelnutzung mit VPN/Reverse Proxy; für mehrere
      Accounts mit eigenen Rechten bräuchte es mehr (ADR-würdig).
- [x] **KI-Vorschläge überleben Neustart** – `ai-store.ts` war eine reine In-Memory-`Map`
      ("gehen bei Neustart verloren", stand so im Code). Jetzt wie `reminders-store.ts` als
      JSON-Datei unter `services/api/data/` (gitignored).
- [x] **Dokument löschen & Original herunterladen** – beides fehlte komplett (weder Route noch
      UI). Neu: `paperless-client.deleteDocument`/`downloadDocument`,
      `DELETE /api/documents/:id` + `GET /api/documents/:id/download` im Gateway,
      "Löschen" (mit Bestätigungsdialog) und "Original herunterladen" in
      `apps/web/src/components/DocumentDetail.tsx`.
- [x] **Mobile: Erinnerungen sichtbar** – `apps/mobile` hatte keinen Reminders-Screen, obwohl das
      Backend das längst kann. Neuer Tab „Erinnerungen" (`RemindersScreen.tsx`) zum Ansehen/
      Erledigt-Markieren. Anlegen bleibt web-only, da Mobile keine Dokumentliste/-detail hat.
- [x] **Backend-Härtung** – `services/api`: zeitkonstanter Token-Vergleich (`timingSafeEqual`,
      401 ohne Details), Rate-Limit (`@fastify/rate-limit`) und Security-Header (`@fastify/helmet`),
      `CORS_ORIGIN` konfigurierbar, zentraler Error-Handler (Paperless-Fehler → 502, keine
      Stacktraces/Tokens im Response), `paperless-client` mit Timeout + Retries/Backoff für GETs,
      `/health` prüft Paperless (`paperless: ok|unreachable`, 503 wenn nicht erreichbar), gesammelte
      Env-Validierung, `API_HOST`, Warnung bei offener API auf nicht-lokalem Host, Graceful Shutdown
      (SIGTERM/SIGINT), `MAX_UPLOAD_MB` (Default 50).
- [ ] **Mobile: Dokumente durchsuchen/bearbeiten** – die App kann bisher nur scannen → hochladen →
      bestätigen, aber keine bestehenden Dokumente durchsuchen oder öffnen. Größeres Stück Arbeit
      (eigene Liste/Detail-Screens analog zu `apps/web`), bewusst nicht nebenbei mit umgesetzt.
- [x] **Deployment-Pfad für die eigenen Services** – Hosting-Frage per
      [ADR 0004](decisions/0004-deployment.md) entschieden (gleicher Docker-Host wie Paperless,
      TLS-Reverse-Proxy oder VPN davor). Umgesetzt: `infra/docker/` (Dockerfiles für api/mail-ingest
      als esbuild-Bundle, web hinter nginx mit `/api`-Proxy), `infra/docker-compose.yml`
      (Gesamtstack mit Healthchecks, Volumes, `restart: unless-stopped`, Profil `mail`),
      `scripts/setup.sh`, README-Abschnitt "Produktiv betreiben". `ai-classifier` ist Lib von `api`.
      Noch offen: CI (`.github/workflows`), Image-Registry, Monitoring/automatische Backups.
- [ ] **Testabdeckung** – `services/api/tests`, `services/mail-ingest/tests`,
      `services/ai-classifier/tests` enthalten nur `.gitkeep`, es gibt noch keinen Testrunner im
      Projekt (kein vitest/jest in den `package.json`). Eigene Aufgabe: erst Testtooling
      einführen, dann Tests nachziehen.

## Phase 7 – Suche & Discovery
`apps/web/src/components/SearchFilter.tsx` deckt Volltext, Korrespondent/Dokumenttyp (als
`<select>`), Datumsbereich und Tag-Toggle-Chips ab, aber Bedienung und Feedback sind noch
rudimentär. Ziel: Filtern fühlt sich schnell, transparent und modern an – näher an Facetten-Suche
als an einem HTML-Formular.
- [ ] **Aktive Filter als Chips sichtbar machen** – aktuell nur ein einzelner "Filter
      zurücksetzen"-Link (`SearchFilter.tsx`, `hasActiveFilters`); einzelne Filter (Tag,
      Korrespondent, Zeitraum, Suchbegriff) sollen als eigene, einzeln entfernbare Chips über der
      Trefferliste erscheinen.
- [ ] **Live-Suche mit Debounce** – `value.query` triggert aktuell bei jedem Tastendruck direkt
      `onChange`; stattdessen serverseitige Suche erst nach kurzer Pause (z. B. 300 ms) auslösen,
      inkl. sichtbarem Lade-/Pending-Zustand während des Debounce.
- [ ] **Kombobox statt `<select>` für Korrespondent/Dokumenttyp** – die neue
      `packages/ui/src/Combobox.tsx` (bisher für "neu anlegen" in `DocumentDetail.tsx` genutzt) als
      Filterelement in `SearchFilter.tsx` einsetzen, inkl. Freitext-Tippen und ggf.
      Mehrfachauswahl statt der bisherigen einzelnen `<select>`-Dropdowns.
- [ ] **Sortierung der Trefferliste** – Datum (neu/alt), Relevanz (bei Volltextsuche), Titel
      (A–Z); Auswahl muss sich mit aktiven Filtern kombinieren lassen.
- [ ] **Datums-Presets** – Schnellauswahl ("Letzte 7 Tage", "Letzter Monat", "Dieses Jahr") über
      den bestehenden Von/Bis-Datumsfeldern, statt jedes Mal manuell zu tippen.
- [ ] **Trefferzahl pro Filter/Facette anzeigen** – z. B. Anzahl Dokumente je Tag/Korrespondent/
      Dokumenttyp neben der jeweiligen Option, damit erkennbar ist, ob ein Filter überhaupt etwas
      liefert, bevor man klickt.
- [ ] **Gespeicherte/zuletzt genutzte Suchen** – häufige Filterkombinationen benennen und wieder
      aufrufen können (lokal oder pro Nutzer im Backend), plus Kurzliste der zuletzt genutzten
      Suchen.
- [ ] **Tastatur-Bedienbarkeit der Filterleiste** – Pfeiltasten/Tab-Reihenfolge durch Tag-Chips und
      neue Kombobox-Vorschläge, sichtbarer Fokus (siehe bereits vorhandene `:focus-visible`-Regeln
      aus Phase 5) auch für neu hinzukommende Filter-Chips und Presets.

## Phase 8 – Skalierung & Komfort im Alltag
Weitere Ziele über die Suche hinaus, die für produktive Nutzung mit wachsender Dokumentmenge
sinnvoll sind.
- [x] **Volltext-Highlighting der Treffer** – Suchbegriff wird in Titel und einem ~120 Zeichen
      langen Content-Ausschnitt der Dokumentliste hervorgehoben (`<mark>`, eigener
      `document-list__highlight`-Stil auf Basis des vorhandenen Warn-Farbtokens), der Ausschnitt
      erscheint nur, wenn die Suche tatsächlich im Inhalt trifft (`DocumentList.tsx`).
- [x] **Bulk-Aktionen auf der Dokumentliste** – Checkboxen pro Dokument + "Alle auswählen" in
      `DocumentList.tsx`, Toolbar für Tag hinzufügen/entfernen, Korrespondent setzen,
      Dokumenttyp setzen, Löschen (mit Bestätigung). Nutzt den echten Paperless-Bulk-Endpoint
      `POST /api/documents/bulk_edit/` (gegen die lokale Paperless-ngx-3.2.1-Instanz verifiziert,
      alle sechs Methoden getestet) statt N einzelner Calls – neue `bulkEditDocuments()` in
      `packages/paperless-client`, `BulkEditAction`-Union in `shared-types`, Route
      `POST /api/documents/bulk-edit` im Gateway.
- [x] **Performance bei großen Dokumentmengen** – echte Pagination statt Virtualisierung (passt
      zum bestehenden REST-Schema, keine neue Abhängigkeit nötig). `PaperlessClient.listDocuments`
      gibt jetzt `{ results, count, page, pageSize }` zurück statt die Paperless-Pagination-Metadaten
      zu verwerfen; `page`-Query-Param durchgereicht bis zum Gateway; `DocumentList.tsx` zeigt eine
      Zurück/Weiter-Leiste, `App.tsx` setzt die Seite bei Filteränderung zurück. Breaking Change im
      Rückgabetyp von `listDocuments`, alle drei Aufrufstellen mit angepasst.
- [x] **Export-/Backup-Strategie für eigene Zusatzdaten** – ADR
      [0003](decisions/0003-backup-export-strategy.md): Hauptweg bleibt das normale
      Host-Backup (tar/rsync/Snapshot) von `services/api/data/`, dafür kein eigener Code nötig.
      Zusätzlich neuer `GET /api/backup/export`-Endpoint (`routes/backup.ts`) für einen JSON-Snapshot
      (KI-Vorschläge + Erinnerungen) ohne Host-Zugriff, z. B. vor einem Update. Bewusst nicht gebaut:
      eigener Backup-Dienst, Versionshistorie, Verschlüsselung, API-Restore (Restore bleibt manuell
      über die Store-Dateien) – unverhältnismäßig für diese Datenmenge.
- [x] **Benachrichtigung bei neuen KI-Vorschlägen** – Push direkt beim erstmaligen Berechnen/Cachen
      eines Vorschlags in `routes/ai.ts` (`aiStore.set(...)` hat genau eine Aufrufstelle, dort immer
      ein neuer Vorschlag), nicht als periodischer Check wie bei Erinnerungen – ein Vorschlag hat
      anders als eine Erinnerung keinen mehrdeutigen "noch fällig"-Zustand zum erneuten Prüfen.
      Nutzt das vorhandene `broadcastPush` (Web Push + Expo Push, Phase 4) unverändert, Push läuft
      fire-and-forget und blockiert die Suggestion-Response nicht.
- [x] **Mehrsprachigkeit der Oberfläche** – i18next/react-i18next in `apps/web` und `apps/mobile`
      (einzige Ausnahme in Phase 8 mit neuer Abhängigkeit), je App ein `src/i18n/` mit
      synchronem Init und `locales/de.json`, nach Komponente/Screen gruppiert. Bestehender
      deutscher Text wurde 1:1 (keine Umformulierung) aus ~142 Stellen (web) bzw. ~37 (mobile) in
      die Locale-Dateien verschoben; eine zweite Sprache ist später nur eine weitere JSON-Datei +
      ein Eintrag in `resources`, kein Umbau nötig. Hartcodierte Texte in `packages/ui`
      (`Combobox`, `ConfidenceBadge`, `ErrorState`, `UploadProgress`) haben optionale
      Label-Props mit dem bisherigen Deutsch als Default bekommen, damit das Paket selbst ohne
      i18next-Abhängigkeit bleibt. Bewusst nicht angefasst: `console.warn`/Error-Strings (keine
      UI-Copy), `toLocaleDateString("de-DE")`-Datumsformatierung (eigenes Thema, offener
      Follow-up) und rein dekorative Zeichen (`—`, `·`, `€` etc.).
