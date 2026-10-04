import { describe, expect, it } from "vitest";
import type { Reminder } from "@papaerless/shared-types";
import { daysAgo, monthStart, summarizeReminders, topByCount } from "./dashboard";

describe("topByCount", () => {
  it("sortiert absteigend, kappt und berechnet Anteile", () => {
    const r = topByCount(
      [
        { id: 1, name: "A", document_count: 2 },
        { id: 2, name: "B", document_count: 8 },
        { id: 3, name: "C", document_count: 4 },
      ],
      2,
    );
    expect(r.map((i) => i.id)).toEqual([2, 3]);
    expect(r.map((i) => i.share)).toEqual([1, 0.5]);
  });

  it("ignoriert Einträge ohne Dokumente; leere Liste bleibt leer", () => {
    expect(topByCount([{ id: 1, name: "A" }, { id: 2, name: "B", document_count: 0 }])).toEqual([]);
    expect(topByCount([])).toEqual([]);
  });

  it("sortiert bei Gleichstand nach Name", () => {
    const r = topByCount([
      { id: 1, name: "Zeta", document_count: 3 },
      { id: 2, name: "Alpha", document_count: 3 },
    ]);
    expect(r.map((i) => i.name)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("Datumshilfen", () => {
  const now = new Date(2026, 9, 4);
  it("monthStart liefert den Monatsersten", () => expect(monthStart(now)).toBe("2026-10-01"));
  it("daysAgo rechnet über Monatsgrenzen", () => expect(daysAgo(now, 4)).toBe("2026-09-30"));
});

describe("summarizeReminders", () => {
  const mk = (id: string, dueDate: string): Reminder => ({
    id,
    documentId: 1,
    documentTitle: "Doc",
    kind: "due_date",
    dueDate,
  });
  it("zählt überfällige und liefert die nächsten sortiert", () => {
    const s = summarizeReminders(
      [mk("c", "2026-12-01"), mk("a", "2026-09-01"), mk("b", "2026-10-04"), mk("d", "2027-01-01")],
      new Date(2026, 9, 4),
      3,
    );
    expect(s.overdue).toBe(1);
    expect(s.upcoming.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
