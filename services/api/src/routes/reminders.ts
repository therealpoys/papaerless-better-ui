import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ReminderKind } from "@papaerless/shared-types";
import { paperless } from "../paperless.js";
import { remindersStore } from "../reminders-store.js";

export async function reminderRoutes(app: FastifyInstance) {
  app.get("/reminders", async () => remindersStore.list());

  app.post("/reminders", async (request, reply) => {
    const body = request.body as { documentId: number; kind: ReminderKind; dueDate: string; note?: string };

    if (!body.documentId || !body.kind || !body.dueDate) {
      return reply.code(400).send({ error: "documentId, kind und dueDate sind erforderlich" });
    }

    const doc = await paperless.getDocument(body.documentId);

    return remindersStore.add({
      id: randomUUID(),
      documentId: body.documentId,
      documentTitle: doc.title || `Dokument #${body.documentId}`,
      kind: body.kind,
      dueDate: body.dueDate,
      note: body.note,
    });
  });

  app.post("/reminders/:id/dismiss", async (request) => {
    const { id } = request.params as { id: string };
    await remindersStore.remove(id);
    return { ok: true };
  });
}
