import type { FastifyInstance } from "fastify";
import { paperless } from "../paperless.js";

export async function documentRoutes(app: FastifyInstance) {
  app.get("/documents", async (request) => {
    const { pageSize } = request.query as { pageSize?: string };
    return paperless.listDocuments({
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  });

  app.get("/documents/:id", async (request) => {
    const { id } = request.params as { id: string };
    return paperless.getDocument(Number(id));
  });

  app.patch("/documents/:id", async (request) => {
    const { id } = request.params as { id: string };
    const patch = request.body as Parameters<typeof paperless.updateDocument>[1];
    return paperless.updateDocument(Number(id), patch);
  });

  app.post("/documents/upload", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: "Keine Datei im Request gefunden" });
    }

    const buffer = await file.toBuffer();
    const taskId = await paperless.uploadDocument(
      new Blob([buffer], { type: file.mimetype }),
      file.filename,
    );

    return { taskId };
  });
}
