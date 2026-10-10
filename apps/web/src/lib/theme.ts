/** Darstellung: Hell, Dunkel oder System. Auswahl in localStorage, Wirkung über data-theme am <html>. */

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "papaerless.theme";
export const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function getStoredTheme(storage: StorageLike | null = defaultStorage()): ThemePreference {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

/** "system" entfernt das Attribut, damit prefers-color-scheme gilt. */
export function applyTheme(
  preference: ThemePreference,
  root: { setAttribute: (n: string, v: string) => void; removeAttribute: (n: string) => void } = document.documentElement,
): void {
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

/** Speichert und wendet an; liefert false, wenn das Speichern nicht möglich war (Wirkung bleibt trotzdem). */
export function setTheme(
  preference: ThemePreference,
  storage: StorageLike | null = defaultStorage(),
  root?: Parameters<typeof applyTheme>[1],
): boolean {
  applyTheme(preference, root);
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
    return storage !== null;
  } catch {
    return false;
  }
}
