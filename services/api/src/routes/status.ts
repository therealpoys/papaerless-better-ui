import type { FastifyInstance } from "fastify";
import { paperless } from "../paperless.js";

/**
 * Geschützter Statuscheck für "Verbindung testen": Wer hier eine Antwort bekommt, ist am Backend
 * angemeldet (sonst 401 durch die Auth); `paperless` zeigt getrennt, ob Paperless erreichbar ist.
 */
export async function statusRoutes(app: FastifyInstance) {
  app.get("/status", async () => ({
    backend: "ok" as const,
    paperless: (await paperless.ping()) ? ("ok" as const) : ("unreachable" as const),
  }));
}
