import type { FastifyInstance } from "fastify";
import { aiEnabled } from "../ai.js";
import { initAutoSuggestBaseline, runAutoSuggestCycle } from "../auto-suggest.js";
import { settingsStore } from "../settings-store.js";

export async function settingsRoutes(app: FastifyInstance) {
  const view = async () => ({ autoSuggest: (await settingsStore.get()).autoSuggest, aiEnabled });

  app.get("/settings", view);

  app.put("/settings", async (request, reply) => {
    const body = request.body as { autoSuggest?: unknown } | null;
    if (!body || typeof body.autoSuggest !== "boolean") {
      return reply.code(400).send({ error: "autoSuggest muss true oder false sein" });
    }
    const before = await settingsStore.get();
    const enabling = body.autoSuggest && !before.autoSuggest;
    await settingsStore.update({
      autoSuggest: body.autoSuggest,
      // Beim Einschalten nur Dokumente ab jetzt berücksichtigen, nicht den Bestand
      ...(enabling ? { autoSuggestAfterId: null } : {}),
    });
    if (enabling) {
      // Baseline sofort setzen (sonst verpasst man Uploads bis zum nächsten Poll); Fehler holt der Poll nach.
      await initAutoSuggestBaseline().catch(() => undefined);
      void runAutoSuggestCycle().catch((err) => console.error("Auto-Vorschlag-Lauf fehlgeschlagen:", err));
    }
    return view();
  });
}
