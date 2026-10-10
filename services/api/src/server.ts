import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { PaperlessError } from "@papaerless/paperless-client";
import Fastify from "fastify";
import { aiEnabled } from "./ai.js";
import { startAutoSuggest } from "./auto-suggest.js";
import { registerAuth } from "./auth.js";
import { env, isLocalHost } from "./env.js";
import { paperless } from "./paperless.js";
import { startRemindersNotifier } from "./reminders-notifier.js";
import { aiRoutes } from "./routes/ai.js";
import { backupRoutes } from "./routes/backup.js";
import { folderRoutes } from "./routes/folders.js";
import { documentRoutes } from "./routes/documents.js";
import { metadataRoutes } from "./routes/metadata.js";
import { pushRoutes } from "./routes/push.js";
import { reminderRoutes } from "./routes/reminders.js";
import { settingsRoutes } from "./routes/settings.js";
import { statusRoutes } from "./routes/status.js";

const app = Fastify({ logger: true });

if (!env.apiAuthToken && !isLocalHost) {
  app.log.warn(
    `API_AUTH_TOKEN ist nicht gesetzt, aber die API lauscht auf ${env.apiHost} – ` +
      "sie ist damit ungeschützt im Netzwerk erreichbar. Token setzen oder API_HOST=127.0.0.1 verwenden.",
  );
}

// Zentraler Error-Handler: nie Stacktraces, Tokens oder Paperless-Bodies an den Client.
app.setErrorHandler((error, request, reply) => {
  if (error instanceof PaperlessError) {
    const err = error;
    request.log.error({ err, detail: err.detail, paperlessStatus: err.status }, "Paperless-Fehler");
    return reply.code(502).send({ error: "Paperless-Fehler", message: err.message });
  }
  const err = error as Error & { statusCode?: number };
  const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  if (status >= 500) {
    request.log.error({ err }, "Unbehandelter Fehler");
    return reply.code(status).send({ error: "Interner Serverfehler" });
  }
  // 4xx (Validierung, Payload zu groß, Rate-Limit) – Fastify-Meldungen enthalten keine Interna
  return reply.code(status).send({ error: err.message });
});

// exposedHeaders: Content-Disposition muss für den Browser lesbar sein, sonst
// fällt der Original-Dateiname beim Download auf den Platzhalter zurück (fetch()
// blendet sonst alle Nicht-Standard-Response-Header vor JS aus).
await app.register(cors, { origin: env.corsOrigin ?? true, exposedHeaders: ["Content-Disposition"] });
await app.register(helmet);
await app.register(rateLimit, {
  max: env.rateLimitMax,
  timeWindow: env.rateLimitWindowMs,
  allowList: (req) => req.url === "/health",
});
await app.register(multipart, { limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 } });
await registerAuth(app);

app.get("/health", async (_request, reply) => {
  const reachable = await paperless.ping();
  return reply.code(reachable ? 200 : 503).send({
    status: reachable ? "ok" : "degraded",
    paperless: reachable ? "ok" : "unreachable",
    aiEnabled,
  });
});

await app.register(documentRoutes, { prefix: "/api" });
await app.register(folderRoutes, { prefix: "/api" });
await app.register(metadataRoutes, { prefix: "/api" });
await app.register(aiRoutes, { prefix: "/api" });
await app.register(reminderRoutes, { prefix: "/api" });
await app.register(pushRoutes, { prefix: "/api" });
await app.register(backupRoutes, { prefix: "/api" });
await app.register(settingsRoutes, { prefix: "/api" });
await app.register(statusRoutes, { prefix: "/api" });

const stopNotifier = startRemindersNotifier();
const stopAutoSuggest = startAutoSuggest();

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} empfangen – fahre herunter`);
  stopNotifier();
  stopAutoSuggest();
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

app.listen({ port: env.apiPort, host: env.apiHost }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
