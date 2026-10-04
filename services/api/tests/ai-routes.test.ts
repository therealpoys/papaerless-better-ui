import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paperless = vi.hoisted(() => ({ getDocument: vi.fn(), listTags: vi.fn() }));
vi.mock("../src/paperless.js", () => ({ paperless }));
vi.mock("../src/ai.js", () => ({ aiEnabled: false, classifier: null }));
const autoSuggest = vi.hoisted(() => ({ isSuggesting: vi.fn(), suggestFor: vi.fn() }));
vi.mock("../src/auto-suggest.js", () => autoSuggest);
vi.mock("../src/push-sender.js", () => ({ broadcastPush: vi.fn() }));

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
