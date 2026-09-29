import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({ messages: { create } })),
}));

import { createClassifier } from "../src/index.js";
import { buildPrompt } from "../src/prompt.js";
import type { ClassifyInput } from "../src/types.js";

const input: ClassifyInput = {
  documentId: 42,
  title: "scan_001",
  content: "Stromrechnung Mai 2026",
  knownTags: [{ id: 1, name: "Rechnung" }] as ClassifyInput["knownTags"],
  knownCorrespondents: [{ id: 2, name: "EnBW" }] as ClassifyInput["knownCorrespondents"],
  knownDocumentTypes: [],
};

const reply = (text: string) => ({ content: [{ type: "text", text }] });

beforeEach(() => create.mockReset());

describe("buildPrompt", () => {
  it("enthält bekannte Namen, Titel und Platzhalter für leere Listen", () => {
    const p = buildPrompt(input);
    expect(p).toContain("Bekannte Tags: Rechnung");
    expect(p).toContain("Bekannte Korrespondenten: EnBW");
    expect(p).toContain("Bekannte Dokumenttypen: (keine)");
    expect(p).toContain("scan_001");
  });

  it("kürzt langen OCR-Text auf 6000 Zeichen", () => {
    const p = buildPrompt({ ...input, content: "a".repeat(10_000) });
    expect(p).toContain("a".repeat(6000));
    expect(p).not.toContain("a".repeat(6001));
  });
});

describe("createClassifier", () => {
  it("liefert null ohne Provider", () => {
    expect(createClassifier({})).toBeNull();
  });

  it("verlangt einen API-Key für anthropic", () => {
    expect(() => createClassifier({ provider: "anthropic" })).toThrow(/AI_API_KEY/);
  });

  it("lehnt unbekannte Provider ab", () => {
    expect(() => createClassifier({ provider: "foo", apiKey: "k" })).toThrow(/Unbekannter AI_PROVIDER/);
  });
});

describe("AnthropicClassifier", () => {
  const classifier = () => createClassifier({ provider: "anthropic", apiKey: "k", model: "m" })!;

  it("parst die JSON-Antwort, auch mit umgebendem Text/Markdown", async () => {
    create.mockResolvedValue(
      reply(
        'Hier:\n```json\n{"title":"Stromrechnung","correspondent":"EnBW","documentType":null,"tags":["Rechnung"],"date":"2026-05-01","amount":89.5,"confidence":0.8}\n```',
      ),
    );

    const s = await classifier().classify(input);

    expect(s).toEqual({
      documentId: 42,
      title: "Stromrechnung",
      correspondent: "EnBW",
      documentType: undefined,
      tags: ["Rechnung"],
      date: "2026-05-01",
      amount: 89.5,
      confidence: 0.8,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "m", messages: [{ role: "user", content: buildPrompt(input) }] }),
    );
  });

  it("nimmt confidence 0.5 an, wenn sie fehlt", async () => {
    create.mockResolvedValue(reply('{"title":"X"}'));
    expect((await classifier().classify(input)).confidence).toBe(0.5);
  });

  it("wirft, wenn die Antwort kein JSON enthält", async () => {
    create.mockResolvedValue(reply("Tut mir leid."));
    await expect(classifier().classify(input)).rejects.toThrow(/kein JSON/);
  });
});
