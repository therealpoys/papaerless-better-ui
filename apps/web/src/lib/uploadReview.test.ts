import { describe, expect, it, vi } from "vitest";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { cleanTitle, formFromSuggestion, heuristicSuggestion, saveReview } from "./uploadReview";

const known = {
  tags: [{ id: 1, name: "Rechnung" }, { id: 2, name: "Steuer" }],
  correspondents: [{ id: 10, name: "Telekom" }],
  documentTypes: [{ id: 20, name: "Vertrag" }],
} as Parameters<typeof formFromSuggestion>[1];

const suggestion = (s: Partial<MetadataSuggestion>): MetadataSuggestion => ({ documentId: 1, confidence: 0.9, ...s });

describe("formFromSuggestion", () => {
  it("ordnet bekannte Namen ohne Beachtung von Groß-/Kleinschreibung den vorhandenen Einträgen zu", () => {
    const form = formFromSuggestion(
      suggestion({ title: "Rechnung Mai", correspondent: " telekom ", documentType: "VERTRAG", tags: ["rechnung", "Steuer"] }),
      known,
      "scan.pdf",
    );
    expect(form).toEqual({ title: "Rechnung Mai", correspondent: 10, documentType: 20, tags: [1, 2] });
  });

  it("übernimmt unbekannte Namen als neue Einträge und entfernt Doppelte", () => {
    const form = formFromSuggestion(suggestion({ correspondent: "EnBW", tags: ["Strom", "strom", "Strom"] }), known, "x");
    expect(form.correspondent).toBe("EnBW");
    expect(form.tags).toEqual(["Strom"]);
  });

  it("funktioniert ohne Vorschlag (KI aus): Dateiname als Titel, sonst leer", () => {
    expect(formFromSuggestion(undefined, known, "scan.pdf")).toEqual({
      title: "scan.pdf",
      correspondent: null,
      documentType: null,
      tags: [],
    });
  });
});

describe("saveReview", () => {
  const deps = () => ({
    createCorrespondent: vi.fn().mockResolvedValue({ id: 11 }),
    createDocumentType: vi.fn().mockResolvedValue({ id: 21 }),
    createTag: vi.fn().mockResolvedValue({ id: 3 }),
    updateDocument: vi.fn().mockResolvedValue({}),
  });

  it("legt nur neue Einträge an und speichert IDs am Dokument", async () => {
    const d = deps();
    await saveReview(d, 5, { title: " Titel ", correspondent: "EnBW", documentType: 20, tags: [1, "Strom"] });

    expect(d.createCorrespondent).toHaveBeenCalledWith("EnBW");
    expect(d.createDocumentType).not.toHaveBeenCalled();
    expect(d.createTag).toHaveBeenCalledTimes(1);
    expect(d.createTag).toHaveBeenCalledWith("Strom");
    expect(d.updateDocument).toHaveBeenCalledWith(5, {
      title: "Titel",
      correspondent: 11,
      documentType: 20,
      tags: [1, 3],
    });
  });

  it("speichert 'nichts ausgewählt' als null und nimmt bei leerem Titel die Dokument-ID", async () => {
    const d = deps();
    await saveReview(d, 9, { title: "  ", correspondent: null, documentType: null, tags: [] });

    expect(d.updateDocument).toHaveBeenCalledWith(9, { title: "9", correspondent: null, documentType: null, tags: [] });
  });
});

describe("cleanTitle", () => {
  it("entfernt Endung, Hash-Anhang und Unterstriche", () => {
    expect(cleanTitle("03.6.3 - Rollen_22cd5caf7a604ae7aa9d65e661ff751f-030926-1337-214.pdf")).toBe("03.6.3 - Rollen");
    expect(cleanTitle("Strom_Rechnung_Mai.PDF")).toBe("Strom Rechnung Mai");
  });
});

describe("heuristicSuggestion", () => {
  const doc = (content: string) => ({ id: 3, content });

  it("nimmt die erste sinnvolle Textzeile als Titel", () => {
    const s = heuristicSuggestion(doc("\n  \nab\nLLM Management Plattform - Rechte & Rollen\nVersion 0.1"), "x_y.pdf", known);
    expect(s.title).toBe("LLM Management Plattform - Rechte & Rollen");
  });

  it("nimmt den bereinigten Dateinamen, wenn es keinen brauchbaren Text gibt oder die Zeile zu lang ist", () => {
    expect(heuristicSuggestion(doc(""), "Strom_Mai.pdf", known).title).toBe("Strom Mai");
    expect(heuristicSuggestion(doc("a".repeat(200)), "Strom_Mai.pdf", known).title).toBe("Strom Mai");
  });

  it("schlägt nur vorhandene Absender, Arten und Schlagwörter vor, die im Text vorkommen", () => {
    const s = heuristicSuggestion(
      doc("Ihre Rechnung der TELEKOM\nVertrag Nr. 5, Thema Steuer"),
      "a.pdf",
      known,
    );
    expect(s.correspondent).toBe("Telekom");
    expect(s.documentType).toBe("Vertrag");
    expect(s.tags).toEqual(["Rechnung", "Steuer"]);
  });

  it("lässt alles leer, wenn nichts passt", () => {
    const s = heuristicSuggestion(doc("Hallo Welt, nichts Bekanntes"), "a.pdf", known);
    expect(s.correspondent).toBeUndefined();
    expect(s.documentType).toBeUndefined();
    expect(s.tags).toEqual([]);
  });
});
