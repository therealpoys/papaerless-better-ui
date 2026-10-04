import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paperless = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  listTags: vi.fn(),
  listCorrespondents: vi.fn(),
  listDocumentTypes: vi.fn(),
}));
const classify = vi.hoisted(() => vi.fn());
vi.mock("../src/paperless.js", () => ({ paperless }));
vi.mock("../src/ai.js", () => ({ aiEnabled: true, classifier: { classify } }));
const broadcastPush = vi.hoisted(() => vi.fn());
vi.mock("../src/push-sender.js", () => ({ broadcastPush }));

import { aiStore } from "../src/ai-store.js";
import { runAutoSuggestCycle, suggestFor } from "../src/auto-suggest.js";
import { settingsRoutes } from "../src/routes/settings.js";
import { settingsStore } from "../src/settings-store.js";

let dir: string;

const docs = (...ids: number[]) => ({
  results: ids.map((id) => ({
    id,
    title: `Doc ${id}`,
    content: "text",
    created: "",
    correspondent: null,
    documentType: null,
    tags: [],
  })),
  count: ids.length,
  page: 1,
  pageSize: 25,
});

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "api-auto-"));
  process.env.API_DATA_DIR = dir;
  vi.resetAllMocks();
  broadcastPush.mockResolvedValue(undefined);
  paperless.listTags.mockResolvedValue([]);
  paperless.listCorrespondents.mockResolvedValue([]);
  paperless.listDocumentTypes.mockResolvedValue([]);
  paperless.getDocument.mockImplementation(async (id: number) => docs(id).results[0]);
  classify.mockImplementation(async ({ documentId }: { documentId: number }) => ({ documentId, confidence: 0.9 }));
});

afterEach(async () => {
  delete process.env.API_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("settingsStore", () => {
  it("hat autoSuggest standardmäßig aus und speichert Änderungen", async () => {
    expect((await settingsStore.get()).autoSuggest).toBe(false);
    await settingsStore.update({ autoSuggest: true });
    expect((await settingsStore.get()).autoSuggest).toBe(true);
  });
});

describe("settingsRoutes", () => {
  async function build() {
    const app = Fastify();
    await app.register(settingsRoutes, { prefix: "/api" });
    await app.ready();
    return app;
  }

  it("liefert Standardwerte", async () => {
    const res = await (await build()).inject({ method: "GET", url: "/api/settings" });
    expect(res.json()).toEqual({ autoSuggest: false, aiEnabled: true });
  });

  it("lehnt ungültige Werte ab", async () => {
    const res = await (await build()).inject({ method: "PUT", url: "/api/settings", payload: { autoSuggest: "ja" } });
    expect(res.statusCode).toBe(400);
  });

  it("schaltet ein, setzt die Baseline auf den Bestand und bearbeitet ihn nicht", async () => {
    paperless.listDocuments.mockResolvedValue(docs(7, 5));
    const app = await build();
    const res = await app.inject({ method: "PUT", url: "/api/settings", payload: { autoSuggest: true } });
    expect(res.json().autoSuggest).toBe(true);
    expect((await settingsStore.get()).autoSuggestAfterId).toBe(7);
    await vi.waitFor(() => expect(paperless.listDocuments).toHaveBeenCalled());
    expect(classify).not.toHaveBeenCalled();
    const get = await app.inject({ method: "GET", url: "/api/settings" });
    expect(get.json().autoSuggest).toBe(true);
  });
});

describe("runAutoSuggestCycle", () => {
  it("tut nichts, wenn der Schalter aus ist", async () => {
    expect(await runAutoSuggestCycle()).toBe(0);
    expect(paperless.listDocuments).not.toHaveBeenCalled();
  });

  it("erzeugt Vorschläge nur für neue Dokumente, in aufsteigender Reihenfolge, und merkt sich den Stand", async () => {
    await settingsStore.update({ autoSuggest: true, autoSuggestAfterId: 5 });
    paperless.listDocuments.mockResolvedValue(docs(8, 7, 5, 3));
    expect(await runAutoSuggestCycle()).toBe(2);
    expect(classify.mock.calls.map((c) => c[0].documentId)).toEqual([7, 8]);
    expect((await settingsStore.get()).autoSuggestAfterId).toBe(8);
    expect(await aiStore.get(7)).toBeDefined();

    expect(await runAutoSuggestCycle()).toBe(0);
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it("berechnet gecachte Vorschläge nicht neu", async () => {
    await settingsStore.update({ autoSuggest: true, autoSuggestAfterId: 1 });
    await aiStore.set({ documentId: 2, confidence: 1 });
    paperless.listDocuments.mockResolvedValue(docs(2));
    expect(await runAutoSuggestCycle()).toBe(0);
    expect(classify).not.toHaveBeenCalled();
    expect((await settingsStore.get()).autoSuggestAfterId).toBe(2);
  });

  it("überspringt fehlgeschlagene Dokumente ohne Endlosschleife", async () => {
    await settingsStore.update({ autoSuggest: true, autoSuggestAfterId: 1 });
    paperless.listDocuments.mockResolvedValue(docs(3, 2));
    classify.mockRejectedValueOnce(new Error("Ollama down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runAutoSuggestCycle()).toBe(1);
    expect((await settingsStore.get()).autoSuggestAfterId).toBe(3);
  });

  it("initialisiert eine fehlende Baseline, ohne zu klassifizieren", async () => {
    await settingsStore.update({ autoSuggest: true });
    paperless.listDocuments.mockResolvedValue(docs(4, 2));
    expect(await runAutoSuggestCycle()).toBe(0);
    expect((await settingsStore.get()).autoSuggestAfterId).toBe(4);
    expect(classify).not.toHaveBeenCalled();
  });
});

describe("suggestFor", () => {
  it("startet für dasselbe Dokument nur einen Lauf gleichzeitig", async () => {
    let release!: () => void;
    classify.mockImplementation(
      ({ documentId }: { documentId: number }) =>
        new Promise((resolve) => {
          release = () => resolve({ documentId, confidence: 1 });
        }),
    );
    const a = suggestFor(9);
    const b = suggestFor(9);
    await vi.waitFor(() => expect(classify).toHaveBeenCalledTimes(1));
    release();
    expect(await a).toEqual(await b);
    expect(classify).toHaveBeenCalledTimes(1);
  });
});
