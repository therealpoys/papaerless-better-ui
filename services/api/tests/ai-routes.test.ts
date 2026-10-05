import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paperless = vi.hoisted(() => ({
  getDocument: vi.fn(),
  listTags: vi.fn(),
  listCorrespondents: vi.fn(),
  listDocumentTypes: vi.fn(),
  createTag: vi.fn(),
  createCorrespondent: vi.fn(),
  createDocumentType: vi.fn(),
  updateDocument: vi.fn(),
}));
vi.mock("../src/paperless.js", () => ({ paperless }));
vi.mock("../src/ai.js", () => ({ aiEnabled: false, classifier: null }));
const autoSuggest = vi.hoisted(() => ({ isSuggesting: vi.fn(), suggestFor: vi.fn() }));
vi.mock("../src/auto-suggest.js", () => autoSuggest);
vi.mock("../src/push-sender.js", () => ({ broadcastPush: vi.fn() }));

import { PaperlessError } from "@papaerless/paperless-client";
import { aiStore } from "../src/ai-store.js";
import { aiRoutes } from "../src/routes/ai.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "api-ai-"));
  process.env.API_DATA_DIR = dir;
  vi.resetAllMocks();
});

afterEach(async () => {
  delete process.env.API_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function build() {
  const app = Fastify();
  await app.register(aiRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("GET /ai/documents/:id/pending", () => {
  it("liefert null, wenn kein Vorschlag existiert, ohne Paperless/KI anzufragen", async () => {
    const res = await (await build()).inject({ method: "GET", url: "/api/ai/documents/7/pending" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ suggestion: null, generating: false });
    expect(paperless.getDocument).not.toHaveBeenCalled();
  });

  it("liefert einen vorhandenen Vorschlag und lässt ihn bestehen", async () => {
    const suggestion = { documentId: 7, title: "Rechnung", tags: ["A"], confidence: 0.8 };
    await aiStore.set(suggestion);
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/ai/documents/7/pending" });
    expect(res.json()).toEqual({ suggestion, generating: false });
    expect(await aiStore.get(7)).toEqual(suggestion);
    expect(paperless.getDocument).not.toHaveBeenCalled();
  });

  it("meldet generating, solange für das Dokument eine KI-Erzeugung läuft", async () => {
    autoSuggest.isSuggesting.mockImplementation((id: number) => id === 7);
    const app = await build();
    const running = await app.inject({ method: "GET", url: "/api/ai/documents/7/pending" });
    expect(running.json()).toEqual({ suggestion: null, generating: true });
    const other = await app.inject({ method: "GET", url: "/api/ai/documents/8/pending" });
    expect(other.json()).toEqual({ suggestion: null, generating: false });
  });

  it("nach dismiss ist der Vorschlag weg", async () => {
    await aiStore.set({ documentId: 7, confidence: 0.5 });
    const app = await build();
    await app.inject({ method: "POST", url: "/api/ai/documents/7/dismiss" });
    const res = await app.inject({ method: "GET", url: "/api/ai/documents/7/pending" });
    expect(res.json()).toEqual({ suggestion: null, generating: false });
  });
});

describe("POST /ai/documents/:id/apply", () => {
  const full = {
    documentId: 7,
    title: "Rechnung Mai",
    correspondent: "EnBW",
    documentType: "Rechnung",
    tags: ["Strom", "Neu"],
    confidence: 0.8,
  };

  beforeEach(() => {
    paperless.listTags.mockResolvedValue([
      { id: 1, name: "Strom" },
      { id: 2, name: "Alt" },
    ]);
    paperless.listCorrespondents.mockResolvedValue([{ id: 10, name: "EnBW" }]);
    paperless.listDocumentTypes.mockResolvedValue([]);
    paperless.createTag.mockResolvedValue({ id: 3 });
    paperless.createDocumentType.mockResolvedValue({ id: 20 });
    paperless.getDocument.mockResolvedValue({ id: 7, tags: [2] });
    paperless.updateDocument.mockResolvedValue({ id: 7 });
  });

  it("ohne fields wird alles übernommen, Tags ersetzen die alten, Vorschlag verschwindet", async () => {
    await aiStore.set(full);
    const res = await (await build()).inject({ method: "POST", url: "/api/ai/documents/7/apply", payload: full });
    expect(res.statusCode).toBe(200);
    expect(paperless.updateDocument).toHaveBeenCalledWith(7, {
      title: "Rechnung Mai",
      correspondent: 10,
      documentType: 20,
      tags: [1, 3],
    });
    expect(await aiStore.get(7)).toBeUndefined();
  });

  it("mit fields wird nur der Absender gesetzt, der Rest des Vorschlags bleibt", async () => {
    await aiStore.set(full);
    await (await build()).inject({
      method: "POST",
      url: "/api/ai/documents/7/apply",
      payload: { ...full, fields: ["correspondent"] },
    });
    expect(paperless.updateDocument).toHaveBeenCalledWith(7, { correspondent: 10 });
    const { correspondent, ...rest } = full;
    expect(await aiStore.get(7)).toEqual(rest);
  });

  it("einzelner Tag wird zu den vorhandenen hinzugefügt und aus dem Vorschlag entfernt", async () => {
    await aiStore.set(full);
    await (await build()).inject({
      method: "POST",
      url: "/api/ai/documents/7/apply",
      payload: { documentId: 7, confidence: 0.8, tags: ["strom"], fields: ["tags"] },
    });
    expect(paperless.updateDocument).toHaveBeenCalledWith(7, { tags: [2, 1] });
    expect((await aiStore.get(7))?.tags).toEqual(["Neu"]);
  });

  it("löscht den Vorschlag, sobald alles einzeln übernommen wurde", async () => {
    await aiStore.set({ documentId: 7, tags: ["Strom"], confidence: 0.5 });
    await (await build()).inject({
      method: "POST",
      url: "/api/ai/documents/7/apply",
      payload: { documentId: 7, confidence: 0.5, tags: ["Strom"], fields: ["tags"] },
    });
    expect(await aiStore.get(7)).toBeUndefined();
  });
});

describe("GET /ai/inbox", () => {
  const suggestion = (documentId: number) => ({ documentId, title: `Doc ${documentId}`, confidence: 0.9 });

  it("entfernt Vorschläge zu Dokumenten, die es in Paperless nicht mehr gibt", async () => {
    await aiStore.set(suggestion(1));
    await aiStore.set(suggestion(2));
    paperless.getDocument.mockImplementation(async (id: number) => {
      if (id === 2) throw new PaperlessError("weg", 404);
    });
    const res = await (await build()).inject({ method: "GET", url: "/api/ai/inbox" });
    expect(res.json().map((s: { documentId: number }) => s.documentId)).toEqual([1]);
    expect(await aiStore.get(2)).toBeUndefined();
  });

  it("behält Vorschläge bei anderen Paperless-Fehlern (z. B. nicht erreichbar)", async () => {
    await aiStore.set(suggestion(1));
    paperless.getDocument.mockRejectedValue(new PaperlessError("down", 503));
    const res = await (await build()).inject({ method: "GET", url: "/api/ai/inbox" });
    expect(res.json()).toHaveLength(1);
    expect(await aiStore.get(1)).toBeDefined();
  });
});
