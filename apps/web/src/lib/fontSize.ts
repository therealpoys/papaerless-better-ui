export type FontSize = "normal" | "large" | "xlarge";

export const FONT_SIZES: FontSize[] = ["normal", "large", "xlarge"];
const STORAGE_KEY = "fontSize";

export function loadFontSize(): FontSize {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (FONT_SIZES as string[]).includes(v)) return v as FontSize;
  } catch {
    // localStorage nicht verfügbar – Standard verwenden
  }
  return "normal";
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.dataset.fontSize = size;
}

export function saveFontSize(size: FontSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Speichern nicht möglich – Auswahl gilt nur für diese Sitzung
  }
}
