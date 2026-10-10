import type { ExpenseDocument } from "@papaerless/shared-types";

export interface DateRange {
  /** YYYY-MM-DD, inklusive. */
  from?: string;
  to?: string;
}

export interface ExpenseGroup {
  /** Eindeutiger Schlüssel: "2026-05" (Monat), "2026" (Jahr) oder die ID bzw. "" (ohne Zuordnung). */
  key: string;
  /** Absender-/Dokumentart-ID; `null` = ohne Zuordnung. Bei Zeitgruppen nicht gesetzt. */
  id?: number | null;
  /** Summe in Euro (auf Cent genau). */
  total: number;
  count: number;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  /** Neueste zuerst. */
  byMonth: ExpenseGroup[];
  byYear: ExpenseGroup[];
  /** Höchste Summe zuerst. */
  byCorrespondent: ExpenseGroup[];
  byDocumentType: ExpenseGroup[];
}

const day = (created: string) => created.slice(0, 10);

/** Dokumente, deren Datum im Zeitraum liegt (Grenzen inklusive, YYYY-MM-DD). */
export function filterByRange<T extends { created: string }>(items: T[], range: DateRange = {}): T[] {
  return items.filter((item) => {
    const d = day(item.created);
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  });
}

/** Summiert in Cent (ganze Zahlen), damit sich keine Fließkomma-Fehler aufaddieren. */
class Sums {
  private readonly map = new Map<string, { id?: number | null; cents: number; count: number }>();
  add(key: string, cents: number, id?: number | null) {
    const entry = this.map.get(key) ?? { id, cents: 0, count: 0 };
    entry.cents += cents;
    entry.count += 1;
    this.map.set(key, entry);
  }
  groups(): ExpenseGroup[] {
    return [...this.map].map(([key, e]) => ({
      key,
      ...(e.id !== undefined && { id: e.id }),
      total: e.cents / 100,
      count: e.count,
    }));
  }
}

const byKeyDesc = (a: ExpenseGroup, b: ExpenseGroup) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0);
const byTotalDesc = (a: ExpenseGroup, b: ExpenseGroup) => b.total - a.total || a.key.localeCompare(b.key);

/** Reine Aggregation der Ausgaben: Summen pro Monat, Jahr, Absender und Dokumentart im Zeitraum. */
export function aggregateExpenses(items: ExpenseDocument[], range: DateRange = {}): ExpenseSummary {
  const month = new Sums();
  const year = new Sums();
  const correspondent = new Sums();
  const documentType = new Sums();
  let cents = 0;

  const inRange = filterByRange(items, range);
  for (const item of inRange) {
    const c = Math.round(item.amount * 100);
    const d = day(item.created);
    cents += c;
    month.add(d.slice(0, 7), c);
    year.add(d.slice(0, 4), c);
    correspondent.add(item.correspondent === null ? "" : String(item.correspondent), c, item.correspondent);
    documentType.add(item.documentType === null ? "" : String(item.documentType), c, item.documentType);
  }

  return {
    total: cents / 100,
    count: inRange.length,
    byMonth: month.groups().sort(byKeyDesc),
    byYear: year.groups().sort(byKeyDesc),
    byCorrespondent: correspondent.groups().sort(byTotalDesc),
    byDocumentType: documentType.groups().sort(byTotalDesc),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-02" -> 2026-02-01..2026-02-28; "2026" -> das ganze Jahr. Ungültiges -> `null`. */
export function periodKeyToRange(key: string): { dateFrom: string; dateTo: string } | null {
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  if (m[2] === undefined) return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { dateFrom: `${y}-${pad(mo)}-01`, dateTo: `${y}-${pad(mo)}-${pad(last)}` };
}

/** Schneidet einen Zeitraum (z. B. einen Monat) auf den gewählten Filter-Zeitraum zu. */
export function clipRange(
  period: { dateFrom: string; dateTo: string },
  range: DateRange,
): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: range.from && range.from > period.dateFrom ? range.from : period.dateFrom,
    dateTo: range.to && range.to < period.dateTo ? range.to : period.dateTo,
  };
}

export type RangePreset = "all" | "thisYear" | "lastYear" | "last12Months";

/** Zeitraum zu einer Schnellauswahl; `today` wird übergeben, damit die Funktion rein bleibt. */
export function presetRange(preset: RangePreset, today: Date): DateRange {
  const y = today.getFullYear();
  switch (preset) {
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "last12Months": {
      const start = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1);
      const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { from: iso(start), to: iso(today) };
    }
    default:
      return {};
  }
}
