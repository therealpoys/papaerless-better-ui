# 0003 – Export-/Backup-Strategie für eigene Zusatzdaten

**Status:** entschieden (2026-09-28)

## Kontext
Paperless-ngx bleibt Source of Truth für Dokumente – die werden dort gesichert, nicht von uns.
Zusätzlich legt `services/api` aber eigene Zusatzdaten an, die es nur bei uns gibt:

- KI-Vorschläge (`ai-store.ts` → `services/api/data/ai-suggestions.json`)
- Erinnerungen (`reminders-store.ts` → `services/api/data/reminders.json`)

Beide liegen als flache JSON-Dateien (`json-store.ts`) in `services/api/data/`, ein gitignoretes
Verzeichnis auf dem Host, auf dem `services/api` läuft. Geht dieser Host verloren, sind diese
Daten weg. Zu klären: wie werden sie gesichert/exportiert?

## Optionen
| Option | Beschreibung |
|---|---|
| Nur Doku ("es sind Dateien") | Kein Code; Betreiber:innen sichern `services/api/data/` mit ihrem üblichen Host-Backup (Cron + `rsync`/`tar`, Volume-Snapshot, …) |
| Export-Endpoint | `GET /api/backup/export` liefert beide Stores gebündelt als ein JSON-Dokument, das man herunterladen/abspeichern kann |
| Scheduled Backup-Service | Eigener Dienst, der periodisch Backups erzeugt und irgendwohin verschiebt (z.B. S3) |
| Versionierte Backup-Historie / Verschlüsselung | Mehrere Zeitpunkte vorhalten, Backups verschlüsseln |

## Entscheidung
**Doku + einfacher Export-Endpoint**, kein eigener Backup-Dienst.

Begründung: Die Datenmenge ist klein (zwei flache JSON-Listen, keine Binärdaten, keine
Dokumenteninhalte – die liegen ja weiterhin nur in Paperless). Ein eigener geplanter
Backup-Dienst, Verschlüsselung oder eine versionierte Backup-Historie wären für diese
Datenmenge deutlich überdimensioniert und bringen operative Komplexität (weiterer Prozess,
weitere Config, weitere Fehlerquelle), ohne dass der Datenverlustfall das rechtfertigt – im
Zweifel lassen sich KI-Vorschläge neu generieren und Erinnerungen sind schnell manuell neu
angelegt, sie sind kein unwiederbringlicher Datenbestand wie die Dokumente selbst.

Konkret:

1. **Basis-Backup: Dateisystem.** `services/api/data/` sind gewöhnliche Dateien auf dem Host.
   Der einfachste, robusteste Weg ist, sie mit dem ohnehin vorhandenen Host-Backup mitzusichern
   (Cron-`tar`/`rsync`, Volume-Snapshot bei Docker, etc.) – dafür ist kein zusätzlicher Code in
   diesem Repo nötig, nur die Anleitung unten.
2. **Zusätzlich: `GET /api/backup/export`.** Für den Fall, dass jemand ohne Host-/Dateisystem-
   Zugriff (z.B. nur über die Web-UI/API) einen Snapshot ziehen möchte – etwa vor einem Update,
   oder um die Daten manuell an einem anderen Ort abzulegen – gibt es einen Read-only-Endpoint,
   der beide Stores plus Zeitstempel als ein JSON-Bundle zurückgibt. Kein Scheduling, kein
   Schreiben/Wiederherstellen über die API (Restore passiert nötigenfalls durch Zurückkopieren
   der `.json`-Dateien in `services/api/data/`, siehe unten) – das hält den Endpoint bewusst
   einfach und reduziert die Angriffsfläche (kein Import-Pfad, der validiert/gemerged werden
   müsste).

## Wiederherstellung (manuell)
- Aus Host-Backup: `services/api/data/ai-suggestions.json` und `reminders.json` an ihren Ort
  zurückkopieren, `services/api` neu starten.
- Aus einem `/api/backup/export`-JSON: die Arrays `aiSuggestions`/`reminders` aus dem Bundle
  entnehmen und als `ai-suggestions.json`/`reminders.json` in `services/api/data/` ablegen.

## Konsequenzen
- Kein neuer Dienst, keine neue Dependency, keine neue Config (`.env`) nötig.
- `/api/backup/export` unterliegt derselben `/api/*`-Auth wie alle anderen Routen
  (`registerAuth` in `services/api/src/auth.ts`) – kein separates Auth-Konzept nötig.
- Sollte die Datenmenge/-bedeutung deutlich wachsen (z.B. eigene Dokumenteninhalte, nicht nur
  Metadaten), ist diese Entscheidung zu revidieren – dann würde sich ein eigenes ADR für ein
  echtes Backup-Scheduling lohnen.
