import { describe, expect, it } from "vitest";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { buildExtraRows, withoutApplied } from "./suggestionCompare";
import { buildPath, parseRoute } from "./route";

const base: MetadataSuggestion = { documentId: 1, confidence: 0.9 };

describe("Datum und Betrag im Vorschlag", () => {
  it("buildExtraRows liefert nur vorgeschlagene Felder und erkennt Änderungen", () => {
    expect(buildExtraRows({}, base)).toEqual([]);
    const rows = buildExtraRows(
      { created: "2026-05-01T00:00:00+02:00", amount: 10 },
      { ...base, date: "01.05.2026", amount: "1.234,56 €" as unknown as number },
    );
    expect(rows.map((r) => [r.field, r.current, r.suggested, r.changed])).toEqual([
      ["date", ["2026-05-01"], ["2026-05-01"], false],
      ["amount", ["10.00"], ["1234.56"], true],
    ]);
  });

  it("zeigt ohne vorhandenen Betrag den Vorschlag als Änderung", () => {
    const [row] = buildExtraRows({ created: "2026-05-01" }, { ...base, amount: 5 });
    expect(row).toMatchObject({ field: "amount", current: [], suggested: ["5.00"], changed: true });
  });

  it("ignoriert ungültige Vorschlagswerte", () => {
    expect(buildExtraRows({}, { ...base, date: "irgendwann", amount: Number.NaN })).toEqual([]);
  });

  it("withoutApplied entfernt Datum/Betrag und lässt den Rest stehen", () => {
    const s = { ...base, date: "2026-05-01", amount: 5 };
    expect(withoutApplied(s, ["date"])).toEqual({ ...base, amount: 5 });
    expect(withoutApplied(s, ["date", "amount"])).toBeNull();
  });
});

describe("Ausgaben-Route", () => {
  it("kennt /expenses und baut den Pfad zurück", () => {
    expect(parseRoute("/expenses", "")).toEqual({ tab: "expenses" });
    expect(buildPath({ tab: "expenses" })).toBe("/expenses");
  });
});
