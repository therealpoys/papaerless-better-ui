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
  it("enthält Titel sowie bekannte Absender und Dokumenttypen (leere Liste als Platzhalter)", () => {
    const p = buildPrompt(input);
    expect(p).toContain("Bekannte Absender: EnBW");
    expect(p).toContain("Bekannte Dokumenttypen: (keine)");
    expect(p).toContain("scan_001");
  });

  it("fragt bei Tags offen, was man geben könnte, ohne bekannte Tags vorzugeben", () => {
    const p = buildPrompt(input);
    expect(p).toContain("Was für Tags könnte man diesem Dokument geben?");
    expect(p).not.toContain("Bekannte Tags");
  });

  it("Absender: aus der Liste wählen oder neuen vorschlagen", () => {
    const p = buildPrompt(input);
    expect(p).toContain("aus dieser Liste");
    expect(p).toContain("schlage einen neuen Namen vor");
    expect(p).toContain("Gib immer einen Absender an");
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

describe("Standard-Modell", () => {
  it("nutzt eine gültige Modell-ID, wenn AI_MODEL nicht gesetzt ist", async () => {
    create.mockResolvedValue(reply('{"title":"x"}'));

    await createClassifier({ provider: "anthropic", apiKey: "k" })!.classify(input);

    expect(create.mock.calls[0][0].model).toBe("claude-sonnet-5-5");
  });

  it("nutzt AI_MODEL, wenn gesetzt", async () => {
    create.mockResolvedValue(reply('{"title":"x"}'));

    await createClassifier({ provider: "anthropic", apiKey: "k", model: "claude-haiku-4-5-20251001" })!.classify(input);

    expect(create.mock.calls[0][0].model).toBe("claude-haiku-4-5-20251001");
  });
});

describe("ollama-Provider", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("verlangt AI_MODEL", () => {
    expect(() => createClassifier({ provider: "ollama" })).toThrow(/AI_MODEL/);
  });

  it("ruft /api/chat mit JSON-Format auf und parst die Antwort", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: { content: '{"title":"Rechnung","confidence":0.8}' } })),
    );
    const c = createClassifier({ provider: "ollama", model: "m", baseUrl: "http://o:11434/" })!;
    const s = await c.classify(input);
    expect(s).toMatchObject({ documentId: 42, title: "Rechnung", confidence: 0.8 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://o:11434/api/chat");
    expect(JSON.parse(init.body)).toMatchObject({ model: "m", stream: false, format: "json" });
  });

  it("wirft bei HTTP-Fehler", async () => {
    fetchMock.mockResolvedValue(new Response("model not found", { status: 404 }));
    const c = createClassifier({ provider: "ollama", model: "m" })!;
    await expect(c.classify(input)).rejects.toThrow(/Ollama-Fehler 404/);
  });
});
