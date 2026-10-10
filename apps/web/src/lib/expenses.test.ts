import { describe, expect, it } from "vitest";
import type { ExpenseDocument } from "@papaerless/shared-types";
import { aggregateExpenses, clipRange, filterByRange, periodKeyToRange, presetRange } from "./expenses";
import { formatDate, formatEuro } from "./format";

let nextId = 1;
const doc = (created: string, amount: number, correspondent: number | null = 1, documentType: number | null = 1): ExpenseDocument => ({
  id: nextId++,
  title: "x",
  created,
  correspondent,
  documentType,
  amount,
});

const items = [
  doc("2025-12-31", 10, 1, 1),
  doc("2026-01-05", 0.1, 1, 1),
  doc("2026-01-20", 0.2, 2, 1),
  doc("2026-02-01T00:00:00+01:00", 100, 2, 2),
  doc("2026-02-28", 50.5, null, null),
];

describe("aggregateExpenses", () => {
  it("summiert pro Monat und Jahr (neueste zuerst) ohne Fließkomma-Fehler", () => {
    const s = aggregateExpenses(items);
    expect(s.byMonth.map((g) => [g.key, g.total, g.count])).toEqual([
      ["2026-02", 150.5, 2],
      ["2026-01", 0.3, 2],
      ["2025-12", 10, 1],
    ]);
    expect(s.byYear.map((g) => [g.key, g.total])).toEqual([
      ["2026", 150.8],
      ["2025", 10],
    ]);
    expect(s.total).toBe(160.8);
    expect(s.count).toBe(5);
  });

  it("gruppiert nach Absender und Dokumentart, größte Summe zuerst, ohne Zuordnung separat", () => {
    const s = aggregateExpenses(items);
    expect(s.byCorrespondent.map((g) => [g.id, g.total, g.count])).toEqual([
      [2, 100.2, 2],
      [null, 50.5, 1],
      [1, 10.1, 2],
    ]);
    expect(s.byDocumentType.map((g) => [g.id, g.total])).toEqual([
      [2, 100],
      [null, 50.5],
      [1, 10.3],
    ]);
  });

  it("beachtet den Zeitraum inklusive Grenzen", () => {
    const s = aggregateExpenses(items, { from: "2026-01-20", to: "2026-02-01" });
    expect(s.count).toBe(2);
    expect(s.total).toBe(100.2);
    expect(s.byYear).toHaveLength(1);
  });

  it("liefert für leere Eingabe leere Gruppen", () => {
    expect(aggregateExpenses([])).toEqual({
      total: 0,
      count: 0,
      byMonth: [],
      byYear: [],
      byCorrespondent: [],
      byDocumentType: [],
    });
  });
});

describe("Zeiträume", () => {
  it("filterByRange: offene Grenzen", () => {
    expect(filterByRange(items, { from: "2026-02-01" })).toHaveLength(2);
    expect(filterByRange(items, { to: "2025-12-31" })).toHaveLength(1);
    expect(filterByRange(items)).toHaveLength(5);
  });

  it("periodKeyToRange für Monat, Schaltjahr und Jahr", () => {
    expect(periodKeyToRange("2026-02")).toEqual({ dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(periodKeyToRange("2028-02")).toEqual({ dateFrom: "2028-02-01", dateTo: "2028-02-29" });
    expect(periodKeyToRange("2026")).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-12-31" });
    expect(periodKeyToRange("2026-13")).toBeNull();
    expect(periodKeyToRange("abc")).toBeNull();
  });

  it("clipRange schneidet auf den Filter zu", () => {
    const month = { dateFrom: "2026-02-01", dateTo: "2026-02-28" };
    expect(clipRange(month, { from: "2026-02-10", to: "2026-03-31" })).toEqual({ dateFrom: "2026-02-10", dateTo: "2026-02-28" });
    expect(clipRange(month, {})).toEqual(month);
  });

  it("presetRange", () => {
    const today = new Date(2026, 4, 15); // 15.05.2026
    expect(presetRange("all", today)).toEqual({});
    expect(presetRange("thisYear", today)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(presetRange("lastYear", today)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(presetRange("last12Months", today)).toEqual({ from: "2025-05-16", to: "2026-05-15" });
  });
});

describe("Formatierung", () => {
  it("formatiert Euro und Datum deutsch", () => {
    expect(formatEuro(1234.5).replace(/\s/g, " ")).toBe("1.234,50 €");
    expect(formatDate("2026-05-01")).toBe("01.05.2026");
    expect(formatDate("2026-05-01T23:30:00-05:00")).toBe("01.05.2026");
  });
});
