import type { FastifyInstance } from "fastify";
import { paperless } from "../paperless.js";

export async function metadataRoutes(app: FastifyInstance) {
  app.get("/tags", async () => paperless.listTags());
  app.get("/correspondents", async () => paperless.listCorrespondents());
  app.get("/document-types", async () => paperless.listDocumentTypes());
}
