# 0002 – Mail-Ingest

**Status:** entschieden (2026-09-28)

## Kontext
Phase 3 (E-Mail) sieht vor, Belege/Rechnungen aus E-Mails automatisch nach Paperless zu
bekommen. Paperless-ngx bringt dafür eigene "Mail-Regeln" mit (IMAP-Postfach direkt in
Paperless konfigurieren, Consumer holt Anhänge/E-Mails selbst ab).

## Optionen
| Option | Beschreibung |
|---|---|
| Nur Paperless Mail-Regeln | Postfach direkt in Paperless-ngx (Einstellungen → E-Mail) konfigurieren |
| Eigener `mail-ingest`-Service | Node-Service pollt IMAP selbst, filtert/normalisiert, lädt über den Paperless-Client hoch |

## Entscheidung
Beides: Paperless Mail-Regeln sind der erste, einfachste Weg (kein zusätzlicher Code) und
sollten zuerst gegen ein echtes Postfach getestet werden. Für Fälle, die Paperless' Mail-Regeln
nicht abdecken (z.B. Vorfilterung nach Absender-Whitelist, Umbenennung vor Upload, spätere
Integration mit der KI-Erkennung *bevor* das Dokument in Paperless landet), gibt es zusätzlich
`services/mail-ingest`:

- Pollt ein IMAP-Postfach in konfigurierbarem Intervall (`MAIL_POLL_INTERVAL_MS`).
- Lädt PDF-/Bild-Anhänge über `@papaerless/paperless-client` hoch (dieselbe API wie Web/Mobile).
- Markiert verarbeitete Mails als gelesen, damit nichts doppelt hochgeladen wird.
- Läuft komplett optional – ohne `MAIL_IMAP_*`-Variablen in `.env` bleibt der Service inaktiv.

## Konsequenzen
- Zwei Wege ins System (Paperless-Mail-Regel *oder* `mail-ingest`) – bewusst redundant, damit
  man pro Postfach wählen kann, ohne dass Dokumente doppelt landen. Nicht beide Wege für
  dasselbe Postfach gleichzeitig aktivieren.
- `mail-ingest` speichert nur die Liste bereits verarbeiteter Message-IDs lokal
  (`services/mail-ingest/data/processed.json`), keine eigene Dokumenten-DB.
