import type { FastifyInstance } from "fastify";
import { env } from "./env.js";

/**
 * Ohne gesetztes API_AUTH_TOKEN bleibt das Gateway offen (lokale Entwicklung).
 * Sobald das Token gesetzt ist, brauchen alle /api/*-Requests
 * "Authorization: Bearer <token>" – sonst 401. /health bleibt immer offen
 * (z.B. für Healthchecks eines Reverse Proxys).
 */
export async function registerAuth(app: FastifyInstance) {
  if (!env.apiAuthToken) {
    app.log.warn(
      "API_AUTH_TOKEN ist nicht gesetzt – das Backend nimmt Requests ohne Auth an. " +
        "Nur für lokale Entwicklung geeignet, siehe .env.example.",
    );
    return;
  }

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;

    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (token !== env.apiAuthToken) {
      return reply.code(401).send({ error: "Nicht autorisiert" });
    }
  });
}
