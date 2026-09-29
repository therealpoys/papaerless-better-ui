import type { FastifyInstance } from "fastify";
import { paperless } from "../paperless.js";

export async function documentRoutes(app: FastifyInstance) {
  app.get("/documents", async (request) => {
    const query = request.query as {
      pageSize?: string;
      page?: string;
      query?: string;
      tags?: string | string[];
      correspondent?: string;
      documentType?: string;
      dateFrom?: string;
      dateTo?: string;
      sort?: string;
      sortOrder?: string;
    };

    const tags = query.tags
      ? (Array.isArray(query.tags) ? query.tags : [query.tags]).map(Number)
      : undefined;

    const sort = query.sort === "title" || query.sort === "created" || query.sort === "score" ? query.sort : undefined;
    const sortOrder = query.sortOrder === "asc" || query.sortOrder === "desc" ? query.sortOrder : undefined;

    return paperless.listDocuments({
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      page: query.page ? Number(query.page) : undefined,
      query: query.query,
      tags,
      correspondent: query.correspondent ? Number(query.correspondent) : undefined,
      documentType: query.documentType ? Number(query.documentType) : undefined,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sort,
      sortOrder,
    });
  });

  app.post("/documents/bulk-edit", async (request, reply) => {
    const { documentIds, action } = request.body as {
      documentIds: number[];
      action: Parameters<typeof paperless.bulkEditDocuments>[1];
    };
    await paperless.bulkEditDocuments(documentIds, action);
    return reply.code(204).send();
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

  app.delete("/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await paperless.deleteDocument(Number(id));
    return reply.code(204).send();
  });

  app.get("/documents/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { buffer, contentType, fileName } = await paperless.downloadDocument(Number(id));
    reply.header("Content-Type", contentType);
    reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
    return reply.send(Buffer.from(buffer));
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
