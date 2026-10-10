import type { FastifyInstance } from "fastify";
import {
  normalizeDate,
  parseAmount,
  type ApplySuggestionRequest,
  type MetadataSuggestion,
  type SuggestionField,
} from "@papaerless/shared-types";
import { aiEnabled, classifier } from "../ai.js";
import { aiStore } from "../ai-store.js";
import { isSuggesting, suggestFor } from "../auto-suggest.js";
import { PaperlessError } from "@papaerless/paperless-client";
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

/** Entfernt übernommene Teile aus dem gespeicherten Vorschlag; ist nichts mehr übrig, wird er gelöscht. */
async function removeApplied(documentId: number, fields: SuggestionField[], appliedTags: string[]) {
  const stored = await aiStore.get(documentId);
  if (!stored) return;
  const next: MetadataSuggestion = { ...stored };
  if (fields.includes("title")) delete next.title;
  if (fields.includes("correspondent")) delete next.correspondent;
  if (fields.includes("documentType")) delete next.documentType;
  if (fields.includes("date")) delete next.date;
  if (fields.includes("amount")) delete next.amount;
  if (fields.includes("tags")) {
    const done = new Set(appliedTags.map((t) => t.toLowerCase()));
    next.tags = (next.tags ?? []).filter((t) => !done.has(t.toLowerCase()));
  }
  const open =
    next.title || next.correspondent || next.documentType || next.tags?.length || next.date || next.amount != null;
  if (open) await aiStore.set(next);
  else await aiStore.delete(documentId);
}

export async function aiRoutes(app: FastifyInstance) {
  app.get("/ai/status", async () => ({ enabled: aiEnabled }));

  // Vorschläge zu Dokumenten, die es in Paperless nicht mehr gibt (404), werden hier gleich aufgeräumt.
  // Andere Paperless-Fehler (z. B. nicht erreichbar) lassen den Vorschlag unangetastet.
  app.get("/ai/inbox", async () => {
    const all = await aiStore.list();
    const alive = await Promise.all(
      all.map(async (suggestion) => {
        try {
          await paperless.getDocument(suggestion.documentId);
          return true;
        } catch (err) {
          if (err instanceof PaperlessError && err.status === 404) {
            await aiStore.delete(suggestion.documentId);
            return false;
          }
          return true;
        }
      }),
    );
    return all.filter((_, i) => alive[i]);
  });

  // Wichtig: gecachte Vorschläge kommen jetzt aus einer JSON-Datei (services/api/data),
  // nicht mehr nur aus dem Prozessspeicher – überleben also einen Neustart/Redeploy.

  // Rein lesend: liefert einen vorhandenen Vorschlag, löst aber nie eine KI-Berechnung aus.
  app.get("/ai/documents/:id/pending", async (request) => {
    const { id } = request.params as { id: string };
    const documentId = Number(id);
    const suggestion = (await aiStore.get(documentId)) ?? null;
    return { suggestion, generating: !suggestion && Boolean(isSuggesting(documentId)) };
  });

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
    const { fields, ...suggestion } = request.body as ApplySuggestionRequest;
    const partial = fields !== undefined;
    const wants = (field: SuggestionField) => !partial || fields.includes(field);

    const [tags, correspondents, documentTypes] = await Promise.all([
      paperless.listTags(),
      paperless.listCorrespondents(),
      paperless.listDocumentTypes(),
    ]);

    const patch: Parameters<typeof paperless.updateDocument>[1] = {};
    if (wants("title") && (!partial || suggestion.title)) patch.title = suggestion.title;
    if (wants("correspondent") && (!partial || suggestion.correspondent)) {
      patch.correspondent = await resolveId(suggestion.correspondent, correspondents, (name) =>
        paperless.createCorrespondent(name),
      );
    }
    if (wants("documentType") && (!partial || suggestion.documentType)) {
      patch.documentType = await resolveId(suggestion.documentType, documentTypes, (name) =>
        paperless.createDocumentType(name),
      );
    }
    if (wants("tags") && (!partial || suggestion.tags?.length)) {
      const tagIds = (
        await Promise.all((suggestion.tags ?? []).map((name) => resolveId(name, tags, (n) => paperless.createTag(n))))
      ).filter((tagId): tagId is number => tagId !== null);
      // Teilweises Übernehmen fügt Tags hinzu, statt die vorhandenen zu ersetzen.
      patch.tags = partial
        ? [...new Set([...(await paperless.getDocument(documentId)).tags, ...tagIds])]
        : tagIds;
    }

    // Datum/Betrag nur übernehmen, wenn sie gültig sind (ein kaputter Wert darf die Übernahme nicht kippen).
    const date = normalizeDate(suggestion.date);
    if (wants("date") && date) patch.created = date;
    const amount = parseAmount(suggestion.amount);
    if (wants("amount") && amount !== null) patch.amount = amount;

    const updated = await paperless.updateDocument(documentId, patch);

    if (partial) {
      await removeApplied(documentId, fields, suggestion.tags ?? []);
    } else {
      await aiStore.delete(documentId);
    }
    return updated;
  });

  app.post("/ai/documents/:id/dismiss", async (request) => {
    const { id } = request.params as { id: string };
    await aiStore.delete(Number(id));
    return { ok: true };
  });
}
