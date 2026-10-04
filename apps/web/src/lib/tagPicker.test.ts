import { describe, expect, it } from "vitest";
import { canCreateOption, filterOptions, toggleId } from "./tagPicker";

const options = [
  { id: 1, name: "Steuer" },
  { id: 2, name: "Versicherung" },
  { id: 3, name: "Auto-Versicherung" },
];

describe("filterOptions", () => {
  it("liefert bei leerer Suche alles", () => {
    expect(filterOptions(options, "  ")).toEqual(options);
  });
  it("sucht ohne Beachtung der Groß-/Kleinschreibung in Teilen des Namens", () => {
    expect(filterOptions(options, "versich").map((o) => o.id)).toEqual([2, 3]);
  });
});

describe("canCreateOption", () => {
  it("bietet Neu-Anlegen bei unbekanntem Namen an", () => {
    expect(canCreateOption(options, "Miete")).toBe(true);
  });
  it("nicht bei leerer Eingabe oder exaktem Treffer", () => {
    expect(canCreateOption(options, " ")).toBe(false);
    expect(canCreateOption(options, " steuer ")).toBe(false);
  });
  it("auch bei Teiltreffer, der nicht exakt ist", () => {
    expect(canCreateOption(options, "Steuer 2026")).toBe(true);
  });
});

describe("toggleId", () => {
  it("fügt hinzu und entfernt wieder", () => {
    expect(toggleId([1], 2)).toEqual([1, 2]);
    expect(toggleId([1, 2], 1)).toEqual([2]);
  });
});
