import { timingSafeEqual, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { env } from "./env.js";

/**
 * Ohne gesetztes API_AUTH_TOKEN bleibt das Gateway offen (lokale Entwicklung).
 * Sobald das Token gesetzt ist, brauchen alle /api/*-Requests
 * "Authorization: Bearer <token>" – sonst 401. /health bleibt immer offen
 * (z.B. für Healthchecks eines Reverse Proxys).
 */
// Hash beider Seiten -> gleiche Länge, timingSafeEqual leakt weder Inhalt noch Länge des Tokens.
function tokenMatches(given: string | undefined, expected: string): boolean {
  if (given === undefined) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

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

    if (!tokenMatches(token, env.apiAuthToken!)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
}
