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
  paperlessUrl: required("PAPERLESS_URL"),
  paperlessApiToken: required("PAPERLESS_API_TOKEN"),

  // Ohne IMAP-Host bleibt der Service inaktiv – Mail-Ingest ist optional
  // (Paperless-Mail-Regeln decken den Standardfall bereits ab, siehe ADR 0002).
  imapHost: process.env.MAIL_IMAP_HOST || undefined,
  imapPort: Number(process.env.MAIL_IMAP_PORT ?? 993),
  imapUser: process.env.MAIL_IMAP_USER || undefined,
  imapPassword: process.env.MAIL_IMAP_PASSWORD || undefined,
  imapFolder: process.env.MAIL_IMAP_FOLDER || "INBOX",
  pollIntervalMs: Number(process.env.MAIL_POLL_INTERVAL_MS ?? 60_000),
};

export const mailIngestEnabled = Boolean(env.imapHost && env.imapUser && env.imapPassword);
