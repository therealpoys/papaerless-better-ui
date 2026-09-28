import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { aiEnabled } from "./ai.js";
import { registerAuth } from "./auth.js";
import { env } from "./env.js";
import { startRemindersNotifier } from "./reminders-notifier.js";
import { aiRoutes } from "./routes/ai.js";
import { backupRoutes } from "./routes/backup.js";
import { documentRoutes } from "./routes/documents.js";
import { metadataRoutes } from "./routes/metadata.js";
import { pushRoutes } from "./routes/push.js";
import { reminderRoutes } from "./routes/reminders.js";

const app = Fastify({ logger: true });

// exposedHeaders: Content-Disposition muss für den Browser lesbar sein, sonst
// fällt der Original-Dateiname beim Download auf den Platzhalter zurück (fetch()
// blendet sonst alle Nicht-Standard-Response-Header vor JS aus).
await app.register(cors, { origin: true, exposedHeaders: ["Content-Disposition"] });
await app.register(multipart);
await registerAuth(app);

app.get("/health", async () => ({ status: "ok", aiEnabled }));

await app.register(documentRoutes, { prefix: "/api" });
await app.register(metadataRoutes, { prefix: "/api" });
await app.register(aiRoutes, { prefix: "/api" });
await app.register(reminderRoutes, { prefix: "/api" });
await app.register(pushRoutes, { prefix: "/api" });
await app.register(backupRoutes, { prefix: "/api" });

startRemindersNotifier();

app
  .listen({ port: env.apiPort, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
