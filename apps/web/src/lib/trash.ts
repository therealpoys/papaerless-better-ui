/** Fallback, falls /api/trash/info (noch) nicht geantwortet hat – entspricht dem Paperless-Default. */
export const DEFAULT_TRASH_RETENTION_DAYS = 30;

/** Wie lange der Rückgängig-Hinweis nach dem Löschen sichtbar bleibt. */
export const UNDO_TOAST_MS = 8000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Verbleibende ganze Tage bis Paperless das Dokument endgültig entfernt (nie negativ, 0 = heute). */
export function daysLeftInTrash(deletedAt: string, retentionDays: number, now: Date = new Date()): number {
  const deleted = new Date(deletedAt).getTime();
  if (Number.isNaN(deleted)) return retentionDays;
  const remaining = (deleted + retentionDays * DAY_MS - now.getTime()) / DAY_MS;
  return Math.max(0, Math.ceil(remaining));
}

/** Nur gültige, eindeutige IDs behalten (z. B. für Wiederherstellen aus dem Rückgängig-Hinweis). */
export function uniqueIds(ids: readonly number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}
