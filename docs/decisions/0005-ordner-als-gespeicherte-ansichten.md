# 0005 – Ordner als gespeicherte Ansichten

**Status:** entschieden (2026-10-04)

## Kontext
Nutzer:innen wollen ihre Dokumente in "Ordnern" wiederfinden. Paperless-ngx kennt keine Ordner, sondern
Schlagwörter, Absender (Correspondents) und Dokumentarten. Paperless bleibt Source of Truth für Dokumente;
wir speichern nichts doppelt.

## Optionen
| Option | Beschreibung |
|---|---|
| Speicherpfade (Storage Paths) | Paperless-Speicherpfade als Ordner nutzen – ändern Dateinamen/-ablage im Paperless-Dateisystem, ein Dokument liegt nur in genau einem Pfad, Umbenennen/Umbauen verschiebt Dateien |
| Präfix-Tags | Schlagwörter wie `ordner/Auto` als Ordner-Konvention – vermischt Ordner mit echten Schlagwörtern, verschmutzt Tag-Liste und KI-Vorschläge |
| **Virtuelle Ansichten** | Ein Ordner ist eine gespeicherte Abfrage über Schlagwort, Absender oder Dokumentart |

## Entscheidung
**Virtuelle Ansichten.** Ein Ordner besteht aus `id`, `name` und einem `criterion`
(`{ kind: "tag" | "correspondent" | "documentType", id }`, siehe `Folder`/`FolderCriterion` in
`packages/shared-types`). Der Ordner zeigt alle Dokumente, die dieses Kriterium in Paperless erfüllen.

- **Speicherort:** Definitionen liegen in `services/api/data/folders.json` (`folders-store.ts`), analog zu
  Erinnerungen. Sie gehören ins Backup (siehe ADR 0003).
- **API:** `GET/POST /api/folders`, `PATCH/DELETE /api/folders/:id`. Namen werden getrimmt (max. 60 Zeichen),
  ungültige `kind`/`id` ergeben 400.
- **Vorschau:** `GET /api/documents/:id/thumbnail` reicht das Paperless-Vorschaubild durch
  (`Cache-Control: private, max-age=3600`); das Paperless-Token bleibt im Backend.
- Keine Doppel-Speicherung: es werden nur Definitionen gespeichert, keine Dokumente oder Zuordnungen.

## Konsequenzen
- Ein Dokument kann in mehreren Ordnern erscheinen; Zuordnung ändert sich automatisch mit den Metadaten in Paperless.
- Wird ein Schlagwort/Absender/eine Art in Paperless gelöscht, zeigt der Ordner nichts mehr an; er wird nicht
  automatisch entfernt (Aufräumen durch Nutzer:in, ggf. später).
- Nur ein Kriterium pro Ordner; Kombinationen (UND/ODER) sind bewusst nicht Teil dieser Entscheidung.
