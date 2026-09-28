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
- [ ] Korrespondent, Dokumenttyp und Tags im Dokument-Detail neu **anlegen** können, nicht nur aus
      bestehender Liste auswählen (aktuell nur `<select>`/Chips über vorhandene Werte). Suche &
      Filter danach entsprechend erweitern.
      - `paperless-client` hat `createTag`/`createCorrespondent`/`createDocumentType` schon
        (`packages/paperless-client/src/index.ts:140-162`), wird bisher aber nur intern vom
        KI-Classifier genutzt (`services/api/src/routes/ai.ts`)
      - `services/api/src/routes/metadata.ts` hat bisher nur GET-Routen – POST-Routen ergänzen
      - Web-UI: Korrespondent/Dokumenttyp von `<select>` auf Combobox mit "Neu anlegen …" umstellen,
        Tags analog zum bestehenden Tag-Picker um ein Eingabefeld erweitern
      - Nach dem Anlegen `listTags`/`listCorrespondents`/`listDocumentTypes` in `App.tsx` neu laden,
        damit der neue Wert sofort im Suchfilter auswählbar ist

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
- [ ] **Mobile: Dokumente durchsuchen/bearbeiten** – die App kann bisher nur scannen → hochladen →
      bestätigen, aber keine bestehenden Dokumente durchsuchen oder öffnen. Größeres Stück Arbeit
      (eigene Liste/Detail-Screens analog zu `apps/web`), bewusst nicht nebenbei mit umgesetzt.
- [ ] **Deployment-Pfad für die eigenen Services** – kein Dockerfile für `api`/`mail-ingest`/
      `ai-classifier`, keine CI (`.github/workflows` existiert nicht). Hängt an der in
      `docs/architecture.md` offenen Hosting-Frage (gleicher Server wie Paperless? Reverse
      Proxy/VPN?) – das ist eine Architekturentscheidung, kein Fix nebenbei; gehört als ADR
      entschieden, bevor Docker/CI gebaut werden.
- [ ] **Testabdeckung** – `services/api/tests`, `services/mail-ingest/tests`,
      `services/ai-classifier/tests` enthalten nur `.gitkeep`, es gibt noch keinen Testrunner im
      Projekt (kein vitest/jest in den `package.json`). Eigene Aufgabe: erst Testtooling
      einführen, dann Tests nachziehen.
