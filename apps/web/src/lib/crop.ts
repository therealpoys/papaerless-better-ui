/** Reine Hilfsfunktionen für den Zuschnitt (ohne DOM, leicht testbar). */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** "move" verschiebt den Rahmen, die anderen Werte ziehen an der jeweiligen Kante/Ecke. */
export type CropHandle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

export const MIN_CROP_SIZE = 40;

/** Verschiebt bzw. verändert den Rahmen um (dx, dy) und hält ihn im Bild und über der Mindestgröße. */
export function adjustRect(
  rect: Rect,
  handle: CropHandle,
  dx: number,
  dy: number,
  bounds: Size,
  min = MIN_CROP_SIZE,
): Rect {
  const minW = Math.min(min, bounds.w);
  const minH = Math.min(min, bounds.h);
  if (handle === "move") {
    return {
      ...rect,
      x: Math.min(Math.max(rect.x + dx, 0), bounds.w - rect.w),
      y: Math.min(Math.max(rect.y + dy, 0), bounds.h - rect.h),
    };
  }
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.w;
  let bottom = rect.y + rect.h;
  if (handle.includes("w")) left = Math.min(Math.max(left + dx, 0), right - minW);
  if (handle.includes("e")) right = Math.max(Math.min(right + dx, bounds.w), left + minW);
  if (handle.includes("n")) top = Math.min(Math.max(top + dy, 0), bottom - minH);
  if (handle.includes("s")) bottom = Math.max(Math.min(bottom + dy, bounds.h), top + minH);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Rechnet den Rahmen von Anzeige-Pixeln in ganze Pixel des Originalbilds um. */
export function toSourceRect(rect: Rect, display: Size, natural: Size): Rect {
  const sx = natural.w / display.w;
  const sy = natural.h / display.h;
  const x = Math.min(Math.max(Math.round(rect.x * sx), 0), natural.w - 1);
  const y = Math.min(Math.max(Math.round(rect.y * sy), 0), natural.h - 1);
  const w = Math.min(Math.max(Math.round(rect.w * sx), 1), natural.w - x);
  const h = Math.min(Math.max(Math.round(rect.h * sy), 1), natural.h - y);
  return { x, y, w, h };
}

/** true, wenn der Rahmen (fast) das ganze Bild umfasst – dann ist kein Zuschnitt nötig. */
export function isFullRect(rect: Rect, bounds: Size, tolerance = 1): boolean {
  return (
    rect.x <= tolerance &&
    rect.y <= tolerance &&
    rect.w >= bounds.w - tolerance &&
    rect.h >= bounds.h - tolerance
  );
}

/**
 * Der Zuschnitt wird immer als JPEG gespeichert: Canvas-PNGs haben einen Alphakanal, an dem die OCR
 * in Paperless scheitern kann, und für Fotos und Scans ist JPEG ohnehin üblich.
 */
export const CROP_OUTPUT = { type: "image/jpeg", extension: "jpg" } as const;

/** Dateiname des Zuschnitts: "rechnung.jpg" → "rechnung-zugeschnitten.jpg". */
export function croppedFileName(name: string, extension: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "foto";
  return `${base}-zugeschnitten.${extension}`;
}

/** Nur Bilder werden zugeschnitten; PDF und E-Mails gehen direkt in den Upload. */
export function isCroppable(file: { name: string; type: string }): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name);
}
