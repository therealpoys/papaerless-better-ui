import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });

// Fehlende/ungültige Variablen sammeln und gesammelt melden statt beim ersten abzubrechen.
const problems: string[] = [];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    problems.push(`${name} fehlt`);
    return "";
  }
  return value;
}

function num(name: string, fallback: number, min = 0): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) {
    problems.push(`${name} muss eine Zahl >= ${min} sein (ist: "${raw}")`);
    return fallback;
  }
  return n;
}

const paperlessUrl = required("PAPERLESS_URL");
if (paperlessUrl) {
  try {
    new URL(paperlessUrl);
  } catch {
    problems.push(`PAPERLESS_URL ist keine gültige URL (ist: "${paperlessUrl}")`);
  }
}

export const env = {
  apiPort: num("API_PORT", 3001, 1),
  // Default 0.0.0.0 wie bisher (Docker/LAN). Für reine Lokalentwicklung: API_HOST=127.0.0.1
  apiHost: process.env.API_HOST || "0.0.0.0",
  paperlessUrl,
  paperlessApiToken: required("PAPERLESS_API_TOKEN"),
  paperlessTimeoutMs: num("PAPERLESS_TIMEOUT_MS", 15_000, 1),

  // Optional, aber dringend empfohlen sobald das Backend nicht mehr nur auf localhost läuft:
  // gemeinsames Bearer-Token, das apps/web und apps/mobile mitschicken müssen.
  // Ohne gesetzten Wert bleibt das Gateway offen (nur für lokale Entwicklung gedacht).
  apiAuthToken: process.env.API_AUTH_TOKEN || undefined,

  // CORS: leer = alle Origins (Dev). Sonst kommagetrennte Liste erlaubter Origins.
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
    : undefined,

  // Rate-Limit: Requests pro Zeitfenster und Client-IP (großzügiger Default)
  rateLimitMax: num("RATE_LIMIT_MAX", 600, 1),
  rateLimitWindowMs: num("RATE_LIMIT_WINDOW_MS", 60_000, 1),

  maxUploadMb: num("MAX_UPLOAD_MB", 50, 1),

  // Optional – KI-Erkennung ist nur aktiv, wenn AI_PROVIDER gesetzt ist
  aiProvider: process.env.AI_PROVIDER || undefined,
  aiApiKey: process.env.AI_API_KEY || undefined,
  aiModel: process.env.AI_MODEL || undefined,

  // Optional – Web Push für Erinnerungen; ohne Keys bleibt Push deaktiviert
  webPushPublicKey: process.env.WEB_PUSH_PUBLIC_KEY || undefined,
  webPushPrivateKey: process.env.WEB_PUSH_PRIVATE_KEY || undefined,
  webPushContactEmail: process.env.WEB_PUSH_CONTACT_EMAIL || "mailto:admin@example.com",
};

if (problems.length > 0) {
  console.error(
    `Ungültige Konfiguration (siehe .env.example):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}

export const isLocalHost = ["127.0.0.1", "localhost", "::1"].includes(env.apiHost);
