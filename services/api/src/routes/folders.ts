import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { FolderCriterion } from "@papaerless/shared-types";
import { foldersStore } from "../folders-store.js";

const MAX_NAME_LENGTH = 60;
const KINDS = ["tag", "correspondent", "documentType"];

function parseName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  return name && name.length <= MAX_NAME_LENGTH ? name : undefined;
}

function parseCriterion(value: unknown): FolderCriterion | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { kind, id } = value as { kind?: unknown; id?: unknown };
  if (typeof kind !== "string" || !KINDS.includes(kind)) return undefined;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return undefined;
  return { kind, id } as FolderCriterion;
}

export async function folderRoutes(app: FastifyInstance) {
  app.get("/folders", async () => foldersStore.list());

  app.post("/folders", async (request, reply) => {
    const body = (request.body ?? {}) as { name?: unknown; criterion?: unknown };
    const name = parseName(body.name);
    if (!name) {
      return reply.code(400).send({ error: `name ist erforderlich (max. ${MAX_NAME_LENGTH} Zeichen)` });
    }
    const criterion = parseCriterion(body.criterion);
    if (!criterion) {
      return reply.code(400).send({ error: "criterion mit gültigem kind und id ist erforderlich" });
    }
    return foldersStore.add({ id: randomUUID(), name, criterion });
  });

  app.patch("/folders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { name?: unknown; criterion?: unknown };
    const patch: { name?: string; criterion?: FolderCriterion } = {};

    if (body.name !== undefined) {
      patch.name = parseName(body.name);
      if (!patch.name) {
        return reply.code(400).send({ error: `name darf nicht leer sein (max. ${MAX_NAME_LENGTH} Zeichen)` });
      }
    }
    if (body.criterion !== undefined) {
      patch.criterion = parseCriterion(body.criterion);
      if (!patch.criterion) {
        return reply.code(400).send({ error: "criterion hat ungültiges kind oder id" });
      }
    }

    const updated = await foldersStore.update(id, patch);
    if (!updated) return reply.code(404).send({ error: "Ordner nicht gefunden" });
    return updated;
  });

  app.delete("/folders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await foldersStore.remove(id);
    return reply.code(204).send();
  });
}
