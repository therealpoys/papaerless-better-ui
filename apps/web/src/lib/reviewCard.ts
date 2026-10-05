import type { SuggestionField } from "@papaerless/shared-types";

export type TextField = Exclude<SuggestionField, "tags">;

export interface ReviewSelection {
  /** Angehakte Textfelder (Titel, Absender, Art). */
  fields: TextField[];
  /** Angewählte Schlagwörter. */
  tags: string[];
}

/** Übersetzt die Auswahl in die Felder für die API; `tags` nur, wenn mindestens einer gewählt ist. */
export function buildApply(selection: ReviewSelection): { fields: SuggestionField[]; onlyTags?: string[] } {
  if (selection.tags.length === 0) return { fields: [...selection.fields] };
  return { fields: [...selection.fields, "tags"], onlyTags: selection.tags };
}

export function selectionCount(selection: ReviewSelection): number {
  return selection.fields.length + selection.tags.length;
}

/** Schaltet einen Eintrag in einer Liste an oder aus (Reihenfolge der übrigen bleibt). */
export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
