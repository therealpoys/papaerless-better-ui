export type PreviewKind = "pdf" | "image" | "other";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.5;

/** Ordnet den Content-Type der Vorschau einer Darstellungsart zu. */
export function previewKind(contentType: string | null | undefined): PreviewKind {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  return "other";
}

/** Begrenzt den Zoomfaktor auf [MIN_ZOOM, MAX_ZOOM]. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Nächster Zoomfaktor bei Klick auf Vergrößern (+1) bzw. Verkleinern (-1). */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(Math.round((zoom + direction * ZOOM_STEP) * 100) / 100);
}
