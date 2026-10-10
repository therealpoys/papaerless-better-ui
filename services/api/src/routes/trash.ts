import type { FastifyInstance } from "fastify";
import { env } from "../env.js";
import { paperless } from "../paperless.js";

function parseIds(body: unknown): number[] | null {
  const ids = (body as { documentIds?: unknown } | null)?.documentIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) return null;
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) return null;
  return ids as number[];
}

export async function trashRoutes(app: FastifyInstance) {
  app.get("/trash", async () => ({
    results: await paperless.listTrash(),
    retentionDays: env.trashRetentionDays,
  }));

  app.get("/trash/info", async () => ({ retentionDays: env.trashRetentionDays }));

  app.post("/trash/restore", async (request, reply) => {
    const ids = parseIds(request.body);
    if (!ids) return reply.code(400).send({ error: "documentIds muss eine nicht leere Liste von IDs sein" });
    await paperless.restoreFromTrash(ids);
    return reply.code(204).send();
  });

  app.post("/trash/delete", async (request, reply) => {
    const ids = parseIds(request.body);
    if (!ids) return reply.code(400).send({ error: "documentIds muss eine nicht leere Liste von IDs sein" });
    await paperless.deleteFromTrash(ids);
    return reply.code(204).send();
  });

  app.post("/trash/empty", async () => ({ deleted: await paperless.emptyTrash() }));
}
