import { normalizeServerUrl } from "./serverUrl";

/** Schema und Version des QR-Payloads: papaerless://setup?v=1&url=<Server-URL>&token=<Gateway-Token> */
export const SETUP_SCHEME = "papaerless:";
export const SETUP_VERSION = "1";
const MAX_PAYLOAD = 2048;
const MAX_TOKEN = 512;

export interface SetupPayload {
  url: string;
  token: string;
}

export type SetupParseError = "notSetupCode" | "unsupportedVersion" | "invalid";

export type SetupParseResult = { ok: true; payload: SetupPayload } | { ok: false; error: SetupParseError };

function validToken(token: string): boolean {
  // druckbares ASCII ohne Leerzeichen, passend zu einem Bearer-Token
  return token.length > 0 && token.length <= MAX_TOKEN && /^[\x21-\x7e]+$/.test(token);
}

/** Erzeugt den Payload-String; wirft bei ungültiger URL oder ungültigem Token. */
export function buildSetupPayload(urlInput: string, token: string): string {
  const normalized = normalizeServerUrl(urlInput);
  if (!normalized.ok) throw new Error("invalid url");
  if (!validToken(token)) throw new Error("invalid token");
  const params = new URLSearchParams({ v: SETUP_VERSION, url: normalized.url, token });
  return `${SETUP_SCHEME}//setup?${params.toString()}`;
}

/** Prüft einen gescannten Text streng; fremde Schemata, Versionen und doppelte/zusätzliche Parameter werden abgelehnt. */
export function parseSetupPayload(raw: string): SetupParseResult {
  const text = raw.trim();
  if (!text || text.length > MAX_PAYLOAD) return { ok: false, error: "notSetupCode" };
  if (!text.toLowerCase().startsWith(`${SETUP_SCHEME}//`)) return { ok: false, error: "notSetupCode" };
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (parsed.protocol !== SETUP_SCHEME || parsed.hostname !== "setup" || parsed.username || parsed.password || parsed.hash) {
    return { ok: false, error: "notSetupCode" };
  }
  if (parsed.pathname !== "" && parsed.pathname !== "/") return { ok: false, error: "invalid" };

  const keys = [...parsed.searchParams.keys()];
  if (new Set(keys).size !== keys.length) return { ok: false, error: "invalid" };
  const version = parsed.searchParams.get("v");
  if (version === null) return { ok: false, error: "invalid" };
  if (version !== SETUP_VERSION) return { ok: false, error: "unsupportedVersion" };
  if (keys.some((k) => k !== "v" && k !== "url" && k !== "token")) return { ok: false, error: "invalid" };

  const url = parsed.searchParams.get("url");
  const token = parsed.searchParams.get("token");
  if (!url || token === null || !validToken(token)) return { ok: false, error: "invalid" };
  const normalized = normalizeServerUrl(url);
  // nur ausdrücklich angegebene http(s)-URLs; normalizeServerUrl würde sonst "evil.com" zu https ergänzen
  if (!normalized.ok || !/^https?:\/\//i.test(url)) return { ok: false, error: "invalid" };
  return { ok: true, payload: { url: normalized.url, token } };
}
