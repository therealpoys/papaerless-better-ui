const STORAGE_KEY = "papaerless.serverUrl";

export type NormalizedUrl = { ok: true; url: string } | { ok: false; error: "empty" | "invalid" };

/**
 * Macht aus einer Nutzereingabe eine Basis-URL ohne Slash am Ende.
 * Ohne Schema wird https:// angenommen. Nur http(s), keine Zugangsdaten, Query oder Hash.
 */
export function normalizeServerUrl(input: string): NormalizedUrl {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, error: "invalid" };
  if (!parsed.hostname || parsed.username || parsed.password) return { ok: false, error: "invalid" };
  const path = parsed.pathname.replace(/\/+$/, "");
  return { ok: true, url: `${parsed.origin}${path}` };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getStoredServerUrl(storage: StorageLike | null = defaultStorage()): string | null {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    if (!value) return null;
    const normalized = normalizeServerUrl(value);
    return normalized.ok ? normalized.url : null;
  } catch {
    return null;
  }
}

/** Speichert die normalisierte URL; liefert sie zurück oder den Fehlergrund. */
export function saveServerUrl(input: string, storage: StorageLike | null = defaultStorage()): NormalizedUrl {
  const normalized = normalizeServerUrl(input);
  if (!normalized.ok) return normalized;
  try {
    storage?.setItem(STORAGE_KEY, normalized.url);
  } catch {
    return { ok: false, error: "invalid" };
  }
  return normalized;
}

/**
 * Welche API-Basis gilt? Im Browser wie bisher (VITE_API_URL oder localhost:3001),
 * in der nativen App nur die gespeicherte Server-URL ("" = noch nicht eingerichtet).
 */
export function resolveApiBase(native: boolean, stored: string | null, envUrl: string | undefined): string {
  if (native) return stored ?? "";
  return envUrl ?? "http://localhost:3001";
}

export function needsServerSetup(native: boolean, stored: string | null): boolean {
  return native && !stored;
}

export type ConnectionResult = "ok" | "unauthorized" | "unreachable" | "notServer";

/** Prüft /health (offen) und danach einen geschützten Endpunkt, um ein falsches Token zu erkennen. */
export async function testConnection(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  headers: Record<string, string> = {},
): Promise<ConnectionResult> {
  try {
    const health = await fetchFn(`${baseUrl}/health`);
    if (!health.ok) return "notServer";
    const protectedRes = await fetchFn(`${baseUrl}/api/ai/status`, { headers });
    if (protectedRes.status === 401 || protectedRes.status === 403) return "unauthorized";
    return protectedRes.ok ? "ok" : "notServer";
  } catch {
    return "unreachable";
  }
}
