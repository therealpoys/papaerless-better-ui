import type {
  Correspondent,
  DocumentType,
  MetadataSuggestion,
  PaperlessDocument,
  SuggestionField,
  Tag,
} from "@papaerless/shared-types";

export type { SuggestionField };

export interface SuggestionRow {
  field: SuggestionField;
  current: string[];
  suggested: string[];
  /** Vorgeschlagene Werte, die es in Paperless noch nicht gibt (werden beim Übernehmen neu angelegt). */
  newNames: string[];
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
  const known = (list: { name: string }[]) => new Set(list.map((x) => x.name.trim().toLowerCase()));
  const knownByField: Record<SuggestionField, Set<string> | null> = {
    title: null,
    correspondent: known(lists.correspondents),
    documentType: known(lists.documentTypes),
    tags: known(lists.tags),
  };
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
    newNames: knownByField[field]
      ? suggested.filter((name) => !knownByField[field]!.has(name.trim().toLowerCase()))
      : [],
    changed: suggested.length > 0 && !same(current, suggested),
  }));
}

const norm = (x: string) => x.trim().toLowerCase();

/** Vorgeschlagene Tags, die das Dokument noch nicht hat (Schreibweise egal). */
export function missingTags(row: Pick<SuggestionRow, "current" | "suggested">): string[] {
  const have = new Set(row.current.map(norm));
  return row.suggested.filter((name) => !have.has(norm(name)));
}

/** Zieht übernommene Teile vom Vorschlag ab; `null`, wenn nichts mehr übrig ist (spiegelt die API). */
export function withoutApplied(
  suggestion: MetadataSuggestion,
  fields: SuggestionField[],
  appliedTags: string[] = [],
): MetadataSuggestion | null {
  const next: MetadataSuggestion = { ...suggestion };
  if (fields.includes("title")) delete next.title;
  if (fields.includes("correspondent")) delete next.correspondent;
  if (fields.includes("documentType")) delete next.documentType;
  if (fields.includes("tags")) {
    const done = new Set(appliedTags.map(norm));
    next.tags = (next.tags ?? []).filter((t) => !done.has(norm(t)));
  }
  const open = next.title || next.correspondent || next.documentType || next.tags?.length;
  return open ? next : null;
}
