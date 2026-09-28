import type { FastifyInstance, FastifyReply } from "fastify";
import { paperless } from "../paperless.js";

function requireName(body: unknown, reply: FastifyReply): string | undefined {
  const name = (body as { name?: string } | undefined)?.name?.trim();
  if (!name) {
    reply.code(400).send({ error: "name ist erforderlich" });
    return undefined;
  }
  return name;
}

export async function metadataRoutes(app: FastifyInstance) {
  app.get("/tags", async () => paperless.listTags());
  app.get("/correspondents", async () => paperless.listCorrespondents());
  app.get("/document-types", async () => paperless.listDocumentTypes());

  app.post("/tags", async (request, reply) => {
    const name = requireName(request.body, reply);
    if (!name) return;
    return paperless.createTag(name);
  });

  app.post("/correspondents", async (request, reply) => {
    const name = requireName(request.body, reply);
    if (!name) return;
    return paperless.createCorrespondent(name);
  });

  app.post("/document-types", async (request, reply) => {
    const name = requireName(request.body, reply);
    if (!name) return;
    return paperless.createDocumentType(name);
  });
}
