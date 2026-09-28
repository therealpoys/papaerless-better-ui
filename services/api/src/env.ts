import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Fehlende Umgebungsvariable: ${name} (siehe .env.example)`);
  }
  return value;
}

export const env = {
  apiPort: Number(process.env.API_PORT ?? 3001),
  paperlessUrl: required("PAPERLESS_URL"),
  paperlessApiToken: required("PAPERLESS_API_TOKEN"),

  // Optional – KI-Erkennung ist nur aktiv, wenn AI_PROVIDER gesetzt ist
  aiProvider: process.env.AI_PROVIDER || undefined,
  aiApiKey: process.env.AI_API_KEY || undefined,
  aiModel: process.env.AI_MODEL || undefined,

  // Optional – Web Push für Erinnerungen; ohne Keys bleibt Push deaktiviert
  webPushPublicKey: process.env.WEB_PUSH_PUBLIC_KEY || undefined,
  webPushPrivateKey: process.env.WEB_PUSH_PRIVATE_KEY || undefined,
  webPushContactEmail: process.env.WEB_PUSH_CONTACT_EMAIL || "mailto:admin@example.com",
};
