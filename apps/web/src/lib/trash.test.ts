import { describe, expect, it } from "vitest";
import { DEFAULT_TRASH_RETENTION_DAYS, daysLeftInTrash, uniqueIds } from "./trash";

describe("daysLeftInTrash", () => {
  const now = new Date("2026-10-10T12:00:00Z");

  it("zählt volle Frist direkt nach dem Löschen", () => {
    expect(daysLeftInTrash("2026-10-10T12:00:00Z", 30, now)).toBe(30);
  });

  it("rundet angebrochene Tage auf", () => {
    expect(daysLeftInTrash("2026-10-09T18:00:00Z", 30, now)).toBe(30);
    expect(daysLeftInTrash("2026-09-10T12:00:00Z", 30, now)).toBe(0);
    expect(daysLeftInTrash("2026-09-11T12:00:00Z", 30, now)).toBe(1);
  });

  it("wird nie negativ", () => {
    expect(daysLeftInTrash("2025-01-01T00:00:00Z", 30, now)).toBe(0);
  });

  it("fällt bei ungültigem Datum auf die Frist zurück", () => {
    expect(daysLeftInTrash("kaputt", 14, now)).toBe(14);
    expect(DEFAULT_TRASH_RETENTION_DAYS).toBe(30);
  });
});

describe("uniqueIds", () => {
  it("entfernt Duplikate und ungültige Werte", () => {
    expect(uniqueIds([3, 3, 0, -1, 1.5, 7])).toEqual([3, 7]);
  });
});
