import type { SuggestionField } from "@papaerless/shared-types";

const norm = (x: string) => x.trim().toLowerCase();

/** Zieht einzeln übernommene Schlagwörter von den noch offenen ab (Schreibweise egal). */
export function withoutTags(open: string[], applied: string[]): string[] {
  const done = new Set(applied.map(norm));
  return open.filter((name) => !done.has(norm(name)));
}

/** true, wenn nichts mehr einzeln zu übernehmen ist: alle befüllten Textfelder erledigt und keine offenen Tags. */
export function isReviewComplete(
  values: Record<Exclude<SuggestionField, "tags">, string>,
  doneFields: SuggestionField[],
  openTags: string[],
): boolean {
  if (openTags.length > 0) return false;
  return (Object.keys(values) as (keyof typeof values)[]).every((f) => !values[f].trim() || doneFields.includes(f));
}
