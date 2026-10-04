import { describe, expect, it } from "vitest";
import {
  criterionName,
  criterionToSearchParams,
  draftFromFolder,
  folderPatch,
  validateFolderDraft,
} from "./folders";

const lookups = {
  tags: [{ id: 1, name: "Steuer" }],
  correspondents: [{ id: 2, name: "Stadtwerke" }],
  documentTypes: [{ id: 3, name: "Rechnung" }],
};

describe("criterionToSearchParams mit Suchfiltern", () => {
  it("ergänzt Schlagwort-Filter um das Ordner-Schlagwort ohne Duplikat", () => {
    expect(criterionToSearchParams({ kind: "tag", id: 1 }, { query: "x", tags: [2, 1] })).toEqual({
      query: "x",
      tags: [2, 1],
    });
  });
  it("Absender/Art des Ordners überschreiben abweichende Filter", () => {
    expect(criterionToSearchParams({ kind: "correspondent", id: 2 }, { correspondent: 9, query: "x" })).toEqual({
      correspondent: 2,
      query: "x",
    });
    expect(criterionToSearchParams({ kind: "documentType", id: 3 }, { documentType: 9 })).toEqual({ documentType: 3 });
  });
});

describe("criterionToSearchParams", () => {
  it("übersetzt Schlagwort, Absender und Art", () => {
    expect(criterionToSearchParams({ kind: "tag", id: 1 })).toEqual({ tags: [1] });
    expect(criterionToSearchParams({ kind: "correspondent", id: 2 })).toEqual({ correspondent: 2 });
    expect(criterionToSearchParams({ kind: "documentType", id: 3 })).toEqual({ documentType: 3 });
  });
  it("übernimmt zusätzliche Parameter", () => {
    expect(criterionToSearchParams({ kind: "tag", id: 1 }, { page: 2, pageSize: 3 })).toEqual({
      page: 2,
      pageSize: 3,
      tags: [1],
    });
  });
});

describe("criterionName", () => {
  it("findet den Namen je nach Art", () => {
    expect(criterionName({ kind: "tag", id: 1 }, lookups)).toBe("Steuer");
    expect(criterionName({ kind: "correspondent", id: 2 }, lookups)).toBe("Stadtwerke");
    expect(criterionName({ kind: "documentType", id: 3 }, lookups)).toBe("Rechnung");
  });
  it("liefert null bei unbekannter ID", () => {
    expect(criterionName({ kind: "tag", id: 99 }, lookups)).toBeNull();
  });
});

describe("validateFolderDraft", () => {
  it("verlangt einen Namen", () => {
    expect(validateFolderDraft({ name: "  ", kind: "tag", criterionId: 1 })).toEqual({ ok: false, error: "nameRequired" });
  });
  it("begrenzt die Namenslänge", () => {
    expect(validateFolderDraft({ name: "x".repeat(81), kind: "tag", criterionId: 1 })).toEqual({
      ok: false,
      error: "nameTooLong",
    });
  });
  it("verlangt ein Kriterium", () => {
    expect(validateFolderDraft({ name: "A", kind: "tag", criterionId: null })).toEqual({
      ok: false,
      error: "criterionRequired",
    });
  });
  it("trimmt den Namen und baut das Kriterium", () => {
    expect(validateFolderDraft({ name: " Steuer ", kind: "tag", criterionId: 0 })).toEqual({
      ok: true,
      value: { name: "Steuer", criterion: { kind: "tag", id: 0 } },
    });
  });
});

describe("folderPatch / draftFromFolder", () => {
  const folder = { id: "f1", name: "Steuer", criterion: { kind: "tag" as const, id: 1 } };
  it("erzeugt Entwurf aus Ordner", () => {
    expect(draftFromFolder(folder)).toEqual({ name: "Steuer", kind: "tag", criterionId: 1 });
  });
  it("liefert nur geänderte Felder", () => {
    expect(folderPatch(folder, { name: "Steuer", criterion: { kind: "tag", id: 1 } })).toEqual({});
    expect(folderPatch(folder, { name: "Neu", criterion: { kind: "tag", id: 1 } })).toEqual({ name: "Neu" });
    expect(folderPatch(folder, { name: "Steuer", criterion: { kind: "correspondent", id: 1 } })).toEqual({
      criterion: { kind: "correspondent", id: 1 },
    });
  });
});
