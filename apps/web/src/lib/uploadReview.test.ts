import { describe, expect, it, vi } from "vitest";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { formFromSuggestion, saveReview } from "./uploadReview";

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
