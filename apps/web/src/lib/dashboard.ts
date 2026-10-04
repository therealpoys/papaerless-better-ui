import type { Reminder } from "@papaerless/shared-types";

export interface CountedItem {
  id: number;
  name: string;
  document_count?: number;
}

export interface RankedItem {
  id: number;
  name: string;
  count: number;
  /** Anteil am größten Eintrag (0–1), für die Balkenbreite. */
  share: number;
}

/** Die `limit` Einträge mit den meisten Dokumenten (Einträge ohne Dokumente fallen weg). */
export function topByCount(items: CountedItem[], limit = 5): RankedItem[] {
  const ranked = items
    .map((i) => ({ id: i.id, name: i.name, count: i.document_count ?? 0 }))
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"))
    .slice(0, limit);
  const max = ranked[0]?.count ?? 1;
  return ranked.map((i) => ({ ...i, share: i.count / max }));
}

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Erster Tag des aktuellen Monats als YYYY-MM-DD (Ortszeit). */
export function monthStart(now: Date): string {
  return isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** Datum `days` Tage vor `now` als YYYY-MM-DD (Ortszeit). */
export function daysAgo(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return isoDay(d);
}

export interface ReminderSummary {
  overdue: number;
  upcoming: Reminder[];
}

/** Überfällige Erinnerungen zählen; die nächsten `limit` (Fälligkeit aufsteigend) zurückgeben. */
export function summarizeReminders(reminders: Reminder[], now: Date, limit = 3): ReminderSummary {
  const today = isoDay(now);
  const sorted = [...reminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    overdue: sorted.filter((r) => r.dueDate.slice(0, 10) < today).length,
    upcoming: sorted.slice(0, limit),
  };
}
