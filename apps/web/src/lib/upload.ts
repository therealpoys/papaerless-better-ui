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
