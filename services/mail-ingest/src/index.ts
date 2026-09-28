import { env, mailIngestEnabled } from "./env.js";
import { runIngestCycle } from "./ingest.js";

if (!mailIngestEnabled) {
  console.log(
    "mail-ingest: MAIL_IMAP_HOST/USER/PASSWORD nicht gesetzt – Service bleibt inaktiv " +
      "(optional, siehe docs/decisions/0002-mail-ingest.md). Nutze stattdessen ggf. Paperless-Mail-Regeln.",
  );
  process.exit(0);
}

async function tick() {
  try {
    const { uploaded, skipped } = await runIngestCycle();
    if (uploaded > 0 || skipped > 0) {
      console.log(`mail-ingest: ${uploaded} Anhang(-hänge) hochgeladen, ${skipped} Mail(s) ohne Anhang übersprungen.`);
    }
  } catch (err) {
    console.error("mail-ingest: Durchlauf fehlgeschlagen:", err);
  }
}

console.log(`mail-ingest: aktiv, Poll-Intervall ${env.pollIntervalMs}ms auf ${env.imapHost}/${env.imapFolder}`);
tick();
setInterval(tick, env.pollIntervalMs);
