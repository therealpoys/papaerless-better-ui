import { describe, expect, it } from "vitest";
import { normalizeDate, parseAmount } from "@papaerless/shared-types";
import { buildPrompt } from "../src/prompt.js";
import { parseSuggestion } from "../src/parse.js";

describe("parseAmount", () => {
  it.each([
    ["1.234,56 €", 1234.56],
    ["EUR 1,234.56", 1234.56],
    ["89,50", 89.5],
    ["89.5", 89.5],
    ["1.234", 1234],
    ["1.234.567,89", 1234567.89],
    ["0.123", 0.12],
    ["12 Euro", 12],
    ["-5,00 €", -5],
    ["EUR12.50", 12.5],
  ])("%s -> %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("nimmt Zahlen (gerundet) und lehnt Unsinn ab", () => {
    expect(parseAmount(89.499)).toBe(89.5);
    expect(parseAmount("kein Betrag")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
  });
});

describe("normalizeDate", () => {
  it("versteht ISO und deutsche Schreibweisen", () => {
    expect(normalizeDate("2026-05-01")).toBe("2026-05-01");
    expect(normalizeDate("2026-05-01T10:00:00Z")).toBe("2026-05-01");
    expect(normalizeDate("01.05.2026")).toBe("2026-05-01");
    expect(normalizeDate("1.5.26")).toBe("2026-05-01");
  });

  it("verwirft ungültige Daten", () => {
    expect(normalizeDate("2026-02-30")).toBeNull();
    expect(normalizeDate("morgen")).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });
});

describe("parseSuggestion mit Betrag und Datum", () => {
  it("wandelt Betragstext und deutsches Datum in Zahl und ISO-Datum", () => {
    const s = parseSuggestion(1, '{"amount":"1.234,56 €","date":"03.04.2026","confidence":0.9}');
    expect(s.amount).toBe(1234.56);
    expect(s.date).toBe("2026-04-03");
  });

  it("lässt unlesbare Werte weg statt sie durchzureichen", () => {
    const s = parseSuggestion(1, '{"amount":"unbekannt","date":"gestern"}');
    expect(s.amount).toBeUndefined();
    expect(s.date).toBeUndefined();
  });
});

describe("buildPrompt für Betrag und Datum", () => {
  it("fragt nach Dokumentdatum und Gesamtbetrag", () => {
    const p = buildPrompt({
      documentId: 1,
      title: "x",
      content: "y",
      knownTags: [],
      knownCorrespondents: [],
      knownDocumentTypes: [],
    });
    expect(p).toContain("Dokumentdatum");
    expect(p).toContain("YYYY-MM-DD");
    expect(p).toContain("Gesamtbetrag");
    expect(p).toContain("Rate nie");
  });
});
