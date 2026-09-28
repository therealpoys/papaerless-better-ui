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
