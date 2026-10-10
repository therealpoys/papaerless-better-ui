import { parseSetupPayload, type SetupParseError } from "./setupPayload";
import { saveServerUrl, testConnection, type ConnectionResult } from "./serverUrl";
import { saveToken } from "./serverToken";

export type QrSetupResult = "ok" | SetupParseError | Exclude<ConnectionResult, "ok"> | "storageFailed";

/**
 * Übernimmt einen gescannten Code: prüft das Format, testet die Verbindung mit dem Token aus dem Code
 * und speichert URL + Token erst bei Erfolg. Das Token wird weder geloggt noch zurückgegeben.
 */
export async function applyScannedSetup(
  raw: string,
  fetchFn: typeof fetch = fetch,
  storeUrl: (url: string) => boolean = (u) => saveServerUrl(u).ok,
  storeToken: (token: string) => boolean = (t) => saveToken(t),
): Promise<QrSetupResult> {
  const parsed = parseSetupPayload(raw);
  if (!parsed.ok) return parsed.error;
  const { url, token } = parsed.payload;
  const result = await testConnection(url, fetchFn, { Authorization: `Bearer ${token}` });
  if (result !== "ok") return result;
  return storeToken(token) && storeUrl(url) ? "ok" : "storageFailed";
}
