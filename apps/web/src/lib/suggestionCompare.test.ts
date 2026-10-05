import { describe, expect, it } from "vitest";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { buildSuggestionRows, missingTags, withoutApplied } from "./suggestionCompare";

const lists = {
  correspondents: [{ id: 1, name: "Telekom" }],
  documentTypes: [{ id: 2, name: "Rechnung" }],
  tags: [
    { id: 3, name: "Steuer" },
    { id: 4, name: "Wohnung" },
  ],
} as never;
const doc = { title: "Scan 1", correspondent: 1, documentType: null, tags: [3] };
const base: MetadataSuggestion = { documentId: 1, confidence: 0.9 };

describe("buildSuggestionRows", () => {
  it("löst IDs zu Namen auf und markiert Abweichungen", () => {
    const rows = buildSuggestionRows(
      doc,
      { ...base, title: "Rechnung Mai", correspondent: "telekom", documentType: "Rechnung", tags: ["Steuer", "Wohnung"] },
      lists,
    );
    expect(rows.map((r) => [r.field, r.changed])).toEqual([
      ["title", true],
      ["correspondent", false],
      ["documentType", true],
      ["tags", true],
    ]);
    expect(rows[1].current).toEqual(["Telekom"]);
  });

  it("Tags: Reihenfolge und Schreibweise egal", () => {
    const rows = buildSuggestionRows({ ...doc, tags: [3, 4] }, { ...base, tags: ["wohnung", "STEUER"] }, lists);
    expect(rows[3].changed).toBe(false);
  });

  it("fehlende Vorschlagswerte gelten nicht als Änderung", () => {
    const rows = buildSuggestionRows(doc, base, lists);
    expect(rows.every((r) => !r.changed)).toBe(true);
    expect(rows[2].current).toEqual([]);
  });

  it("kennzeichnet unbekannte Absender, Arten und Tags als neu (Schreibweise egal)", () => {
    const rows = buildSuggestionRows(
      doc,
      { ...base, correspondent: "Neue GmbH", documentType: "Rechnung", tags: ["wohnung", "Brandneu"] },
      lists,
    );
    expect(rows[0].newNames).toEqual([]);
    expect(rows[1].newNames).toEqual(["Neue GmbH"]);
    expect(rows[3].newNames).toEqual(["Brandneu"]);
  });
});

describe("missingTags", () => {
  it("liefert nur Tags, die das Dokument noch nicht hat", () => {
    expect(missingTags({ current: ["Steuer"], suggested: ["steuer", "Wohnung"] })).toEqual(["Wohnung"]);
  });
});

describe("withoutApplied", () => {
  const full: MetadataSuggestion = { ...base, title: "T", correspondent: "C", documentType: "D", tags: ["A", "B"] };

  it("entfernt übernommene Felder und einzelne Tags", () => {
    expect(withoutApplied(full, ["correspondent"])).toMatchObject({ title: "T", documentType: "D", tags: ["A", "B"] });
    expect(withoutApplied(full, ["correspondent"])?.correspondent).toBeUndefined();
    expect(withoutApplied(full, ["tags"], ["a"])?.tags).toEqual(["B"]);
  });

  it("liefert null, wenn nichts mehr offen ist", () => {
    expect(withoutApplied({ ...base, tags: ["A"] }, ["tags"], ["A"])).toBeNull();
  });
});
