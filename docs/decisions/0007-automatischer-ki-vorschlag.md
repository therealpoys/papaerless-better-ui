# 0007 – Automatischer KI-Vorschlag für neue Dokumente

**Status:** entschieden (2026-10-04)

## Kontext
Vorschläge entstanden nur, wenn jemand ein Dokument öffnete. Gewünscht: Einstellung "Immer KI-Vorschlag", die auch
ohne geöffneten Tab greift – für Uploads über die API und für Mail-Ingest.

## Entscheidung
- Persistente Einstellung `autoSuggest` in `services/api/data/settings.json` (`GET/PUT /api/settings`).
- Die API fragt alle 30 s Paperless nach den zuletzt hinzugefügten Dokumenten (`ordering=-added`) und erzeugt für
  Dokumente mit `id > autoSuggestAfterId` nacheinander einen Vorschlag. Ein Dokument taucht in Paperless erst nach
  abgeschlossener Verarbeitung auf, also entspricht das "fertig verarbeitet".
- Beim Einschalten wird die Baseline auf die aktuell höchste ID gesetzt: der Bestand wird nie automatisch bearbeitet.
- Polling statt Hook im Upload-Pfad, weil Mail-Ingest direkt zu Paperless hochlädt (kein Aufruf der API) und so beide
  Quellen ohne Änderung an `services/mail-ingest` abgedeckt sind.
- `suggestFor()` dedupliziert laufende Erzeugungen je Dokument (auch gegenüber manuellen Anfragen) und liefert
  gecachte Vorschläge aus dem `aiStore`; Fehler werden geloggt, das Dokument nicht endlos wiederholt.

## Konsequenzen
- Verzögerung bis zu 30 s plus KI-Laufzeit (CPU/Ollama: ca. 1–2,5 min pro Dokument, seriell).
- Pro Poll werden höchstens die 25 neuesten Dokumente betrachtet; bei größeren Importen (>25 in 30 s) werden ältere
  übersprungen und können manuell vorgeschlagen werden.
- Die Einstellung ist global (single-user), nicht pro Gerät.
