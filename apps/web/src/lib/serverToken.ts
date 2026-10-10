const STORAGE_KEY = "papaerless.apiToken";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Per QR-Code übernommenes Gateway-Token (nur Gateway, nie das Paperless-Token). */
export function getStoredToken(storage: StorageLike | null = defaultStorage()): string | null {
  try {
    return storage?.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function saveToken(token: string, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, token);
    return true;
  } catch {
    return false;
  }
}

/** Gespeichertes Token hat Vorrang vor dem Build-Token (VITE_API_TOKEN). */
export function resolveToken(stored: string | null, envToken: string | undefined): string | undefined {
  return stored ?? envToken ?? undefined;
}
