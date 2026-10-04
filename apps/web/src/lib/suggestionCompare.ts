import type { Correspondent, DocumentType, MetadataSuggestion, PaperlessDocument, Tag } from "@papaerless/shared-types";

export type SuggestionField = "title" | "correspondent" | "documentType" | "tags";

export interface SuggestionRow {
  field: SuggestionField;
  current: string[];
  suggested: string[];
  /** true, wenn der Vorschlag einen Wert enthält, der vom aktuellen abweicht. */
  changed: boolean;
}

function nameOf(list: { id: number; name: string }[], id: number | null): string[] {
  if (id === null) return [];
  const found = list.find((x) => x.id === id);
  return found ? [found.name] : [];
}

function same(a: string[], b: string[]): boolean {
  const norm = (xs: string[]) => xs.map((x) => x.trim().toLowerCase()).sort();
  const na = norm(a);
  const nb = norm(b);
  return na.length === nb.length && na.every((x, i) => x === nb[i]);
}

/** Stellt aktuelle Dokumentwerte und KI-Vorschlag je Feld gegenüber (reine Funktion). */
export function buildSuggestionRows(
  doc: Pick<PaperlessDocument, "title" | "correspondent" | "documentType" | "tags">,
  suggestion: MetadataSuggestion,
  lists: { correspondents: Correspondent[]; documentTypes: DocumentType[]; tags: Tag[] },
): SuggestionRow[] {
  const entries: [SuggestionField, string[], string[]][] = [
    ["title", doc.title ? [doc.title] : [], suggestion.title ? [suggestion.title] : []],
    [
      "correspondent",
      nameOf(lists.correspondents, doc.correspondent),
      suggestion.correspondent ? [suggestion.correspondent] : [],
    ],
    [
      "documentType",
      nameOf(lists.documentTypes, doc.documentType),
      suggestion.documentType ? [suggestion.documentType] : [],
    ],
    ["tags", doc.tags.flatMap((id) => nameOf(lists.tags, id)), suggestion.tags ?? []],
  ];
  return entries.map(([field, current, suggested]) => ({
    field,
    current,
    suggested,
    changed: suggested.length > 0 && !same(current, suggested),
  }));
}
