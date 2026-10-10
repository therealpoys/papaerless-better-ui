/** Reine Hilfsfunktionen für den Upload (ohne React, leicht testbar). */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type UploadErrorKey = "unsupportedType" | "tooLarge" | "network" | "server";

const ALLOWED_EXTENSIONS = [".pdf", ".eml", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".tif", ".tiff", ".bmp"];

/** Liefert einen Fehlerschlüssel, wenn die Datei schon vor dem Hochladen abgelehnt werden sollte. */
export function validateFile(file: { name: string; type: string; size: number }): UploadErrorKey | null {
  const name = file.name.toLowerCase();
  const typeOk =
    file.type === "application/pdf" ||
    file.type.startsWith("image/") ||
    ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!typeOk) return "unsupportedType";
  if (file.size > MAX_UPLOAD_BYTES) return "tooLarge";
  return null;
}

/** Ordnet einen technischen Fehler einer verständlichen Meldung zu. */
export function classifyUploadError(err: unknown): UploadErrorKey {
  const message = err instanceof Error ? err.message : "";
  if (/\b413\b/.test(message)) return "tooLarge";
  if (/\b(415|422)\b/.test(message)) return "unsupportedType";
  if (/API-Fehler \d{3}/.test(message)) return "server";
  return "network";
}

type TaskStatus = { status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "UNKNOWN"; documentId?: number };

/**
 * Wartet, bis Paperless das hochgeladene Dokument fertig eingelesen hat, und liefert dessen ID.
 * `null` bei Fehlschlag oder wenn es zu lange dauert (dann gibt es einfach keine Vorschläge).
 */
export async function waitForDocumentId(
  getTask: (taskId: string) => Promise<TaskStatus>,
  taskId: string,
  { attempts = 40, intervalMs = 1500 }: { attempts?: number; intervalMs?: number } = {},
): Promise<number | null> {
  for (let i = 0; i < attempts; i++) {
    const task = await getTask(taskId);
    if (task.status === "SUCCESS" && task.documentId) return task.documentId;
    if (task.status === "FAILURE") return null;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

export interface UploadProgressInfo {
  /** 0-100, ganzzahlig */
  percent: number;
  /** Geschätzte Restsekunden; null, solange noch keine verlässliche Schätzung möglich ist. */
  remainingSeconds: number | null;
}

/** Mindestdauer, bevor eine Restzeit angezeigt wird (sonst springt die Schätzung wild). */
const MIN_ELAPSED_MS = 500;

/** Prozent und Restzeit aus dem bisherigen Durchsatz (Bytes pro Sekunde seit Start). */
export function computeUploadProgress(loaded: number, total: number, elapsedMs: number): UploadProgressInfo {
  if (!(total > 0)) return { percent: 0, remainingSeconds: null };
  const safeLoaded = Math.max(0, Math.min(loaded, total));
  const percent = Math.floor((safeLoaded / total) * 100);
  if (safeLoaded >= total) return { percent: 100, remainingSeconds: 0 };
  if (safeLoaded <= 0 || elapsedMs < MIN_ELAPSED_MS) return { percent, remainingSeconds: null };
  const bytesPerMs = safeLoaded / elapsedMs;
  return { percent, remainingSeconds: Math.ceil((total - safeLoaded) / bytesPerMs / 1000) };
}

/** Zerlegt Restsekunden in eine Anzeigeeinheit (Sekunden bis 59, danach aufgerundete Minuten). */
export function remainingTimeParts(seconds: number): { unit: "seconds" | "minutes"; value: number } {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return { unit: "seconds", value: s };
  return { unit: "minutes", value: Math.ceil(s / 60) };
}

/** Verstrichene Zeit als m:ss. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * Hängt neue Dateien an die Liste an. Sind alle bisherigen Einträge fertig (hochgeladen oder
 * fehlgeschlagen), beginnt eine frische Liste; sonst laufen die neuen hinten in die Warteschlange.
 */
export function mergeUploadItems<T extends { status: string }>(prev: T[], added: T[]): T[] {
  const finished = prev.every((item) => item.status === "done" || item.status === "error" || item.status === "skipped");
  return finished ? added : [...prev, ...added];
}
