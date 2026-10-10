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
  listExpenseDocuments: vi.fn(),
}));
vi.mock("../src/paperless.js", () => ({ paperless }));
vi.mock("../src/ai.js", () => ({ aiEnabled: false, classifier: null }));
vi.mock("../src/auto-suggest.js", () => ({ isSuggesting: vi.fn(), suggestFor: vi.fn() }));
vi.mock("../src/push-sender.js", () => ({ broadcastPush: vi.fn() }));

import { aiStore } from "../src/ai-store.js";
import { aiRoutes } from "../src/routes/ai.js";
import { documentRoutes } from "../src/routes/documents.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "api-amount-"));
  process.env.API_DATA_DIR = dir;
  vi.resetAllMocks();
  paperless.listTags.mockResolvedValue([]);
  paperless.listCorrespondents.mockResolvedValue([]);
  paperless.listDocumentTypes.mockResolvedValue([]);
});

afterEach(async () => {
  delete process.env.API_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function build() {
  const app = Fastify();
  await app.register(documentRoutes, { prefix: "/api" });
  await app.register(aiRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("PATCH /documents/:id mit Datum und Betrag", () => {
  it("reicht normalisiertes Datum und Betrag an Paperless durch", async () => {
    paperless.updateDocument.mockResolvedValue({ id: 3 });
    const res = await (
      await build()
    ).inject({ method: "PATCH", url: "/api/documents/3", payload: { created: "03.04.2026", amount: "1.234,56 €" } });
    expect(res.statusCode).toBe(200);
    expect(paperless.updateDocument).toHaveBeenCalledWith(3, { created: "2026-04-03", amount: 1234.56 });
  });

  it("amount: null entfernt den Betrag", async () => {
    paperless.updateDocument.mockResolvedValue({ id: 3 });
    await (await build()).inject({ method: "PATCH", url: "/api/documents/3", payload: { amount: null } });
    expect(paperless.updateDocument).toHaveBeenCalledWith(3, { amount: null });
  });

  it("400 bei ungültigem Datum oder Betrag, ohne Paperless anzufassen", async () => {
    const app = await build();
    const badDate = await app.inject({ method: "PATCH", url: "/api/documents/3", payload: { created: "gestern" } });
    const badAmount = await app.inject({ method: "PATCH", url: "/api/documents/3", payload: { amount: "viel" } });
    expect(badDate.statusCode).toBe(400);
    expect(badAmount.statusCode).toBe(400);
    expect(paperless.updateDocument).not.toHaveBeenCalled();
  });
});

describe("GET /expenses", () => {
  it("liefert die Dokumente mit Betrag und reicht den Zeitraum durch", async () => {
    const docs = [{ id: 1, title: "A", created: "2026-01-02", correspondent: 1, documentType: null, amount: 10 }];
    paperless.listExpenseDocuments.mockResolvedValue(docs);
    const res = await (await build()).inject({ method: "GET", url: "/api/expenses?dateFrom=2026-01-01&dateTo=2026-12-31" });
    expect(res.json()).toEqual(docs);
    expect(paperless.listExpenseDocuments).toHaveBeenCalledWith({ dateFrom: "2026-01-01", dateTo: "2026-12-31" });
  });

  it("400 bei ungültigem Zeitraum", async () => {
    const res = await (await build()).inject({ method: "GET", url: "/api/expenses?dateFrom=morgen" });
    expect(res.statusCode).toBe(400);
    expect(paperless.listExpenseDocuments).not.toHaveBeenCalled();
  });
});

describe("POST /ai/documents/:id/apply mit Datum und Betrag", () => {
  it("übernimmt alles inklusive created und amount", async () => {
    paperless.updateDocument.mockResolvedValue({ id: 5 });
    const res = await (
      await build()
    ).inject({
      method: "POST",
      url: "/api/ai/documents/5/apply",
      payload: { documentId: 5, title: "T", date: "2026-05-01", amount: 89.5, confidence: 0.9 },
    });
    expect(res.statusCode).toBe(200);
    expect(paperless.updateDocument).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ title: "T", created: "2026-05-01", amount: 89.5 }),
    );
  });

  it("übernimmt mit fields nur den Betrag und lässt Datum im Vorschlag stehen", async () => {
    paperless.updateDocument.mockResolvedValue({ id: 5 });
    await aiStore.set({ documentId: 5, date: "2026-05-01", amount: 89.5, confidence: 0.9 });
    await (
      await build()
    ).inject({
      method: "POST",
      url: "/api/ai/documents/5/apply",
      payload: { documentId: 5, date: "2026-05-01", amount: 89.5, confidence: 0.9, fields: ["amount"] },
    });
    expect(paperless.updateDocument).toHaveBeenCalledWith(5, { amount: 89.5 });
    expect(await aiStore.get(5)).toEqual({ documentId: 5, date: "2026-05-01", confidence: 0.9 });
  });

  it("überspringt ungültige Vorschlagswerte", async () => {
    paperless.updateDocument.mockResolvedValue({ id: 5 });
    await (
      await build()
    ).inject({
      method: "POST",
      url: "/api/ai/documents/5/apply",
      payload: { documentId: 5, date: "irgendwann", amount: "viel", confidence: 0.9, fields: ["date", "amount"] },
    });
    expect(paperless.updateDocument).toHaveBeenCalledWith(5, {});
  });
});
