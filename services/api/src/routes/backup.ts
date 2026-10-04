import type { FastifyInstance } from "fastify";
import { aiStore } from "../ai-store.js";
import { foldersStore } from "../folders-store.js";
import { remindersStore } from "../reminders-store.js";

/**
 * Read-only Snapshot der eigenen Zusatzdaten (siehe ADR 0003). Kein Import/Restore
 * über die API – Wiederherstellung passiert manuell über services/api/data/*.json.
 */
export async function backupRoutes(app: FastifyInstance) {
  app.get("/backup/export", async () => {
    const [aiSuggestions, reminders, folders] = await Promise.all([
      aiStore.list(),
      remindersStore.list(),
      foldersStore.list(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      aiSuggestions,
      reminders,
      folders,
    };
  });
}
