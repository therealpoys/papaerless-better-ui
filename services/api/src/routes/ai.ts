import type { FastifyInstance } from "fastify";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { aiEnabled, classifier } from "../ai.js";
import { aiStore } from "../ai-store.js";
import { suggestFor } from "../auto-suggest.js";
import { paperless } from "../paperless.js";

async function resolveId(
  name: string | undefined,
  known: { id: number; name: string }[],
  create: (name: string) => Promise<{ id: number }>,
): Promise<number | null> {
  if (!name) return null;
  const existing = known.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const created = await create(name);
  return created.id;
}

export async function aiRoutes(app: FastifyInstance) {
  app.get("/ai/status", async () => ({ enabled: aiEnabled }));

  app.get("/ai/inbox", async () => aiStore.list());

  // Wichtig: gecachte Vorschläge kommen jetzt aus einer JSON-Datei (services/api/data),
  // nicht mehr nur aus dem Prozessspeicher – überleben also einen Neustart/Redeploy.

  app.get("/ai/documents/:id/suggestion", async (request, reply) => {
    if (!classifier) {
      return reply.code(409).send({
        error: "KI-Erkennung ist deaktiviert. AI_PROVIDER (und AI_API_KEY bzw. AI_MODEL) in .env setzen.",
      });
    }

    const { id } = request.params as { id: string };
    const documentId = Number(id);

    return suggestFor(documentId);
  });

  app.post("/ai/documents/:id/apply", async (request) => {
    const { id } = request.params as { id: string };
    const documentId = Number(id);
    const suggestion = request.body as MetadataSuggestion;

    const [tags, correspondents, documentTypes] = await Promise.all([
      paperless.listTags(),
      paperless.listCorrespondents(),
      paperless.listDocumentTypes(),
    ]);

    const correspondentId = await resolveId(suggestion.correspondent, correspondents, (name) =>
      paperless.createCorrespondent(name),
    );
    const documentTypeId = await resolveId(suggestion.documentType, documentTypes, (name) =>
      paperless.createDocumentType(name),
    );
    const tagIds = await Promise.all(
      (suggestion.tags ?? []).map((name) => resolveId(name, tags, (n) => paperless.createTag(n))),
    );

    const updated = await paperless.updateDocument(documentId, {
      title: suggestion.title,
      correspondent: correspondentId,
      documentType: documentTypeId,
      tags: tagIds.filter((tagId): tagId is number => tagId !== null),
    });

    await aiStore.delete(documentId);
    return updated;
  });

  app.post("/ai/documents/:id/dismiss", async (request) => {
    const { id } = request.params as { id: string };
    await aiStore.delete(Number(id));
    return { ok: true };
  });
}
