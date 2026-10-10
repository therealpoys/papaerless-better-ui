import {
  normalizeDate,
  parseAmount,
  type Correspondent,
  type DocumentType,
  type MetadataSuggestion,
  type PaperlessDocument,
  type SuggestionField,
  type Tag,
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
    date: null,
    amount: null,
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

/** Zusätzliche Zeilen für Dokumentdatum und Betrag (Werte als YYYY-MM-DD bzw. "12.50"); nur wenn vorgeschlagen. */
export function buildExtraRows(
  doc: Partial<Pick<PaperlessDocument, "created" | "amount">>,
  suggestion: MetadataSuggestion,
): SuggestionRow[] {
  const rows: SuggestionRow[] = [];
  const date = normalizeDate(suggestion.date);
  if (date) {
    const current = doc.created ? normalizeDate(doc.created) : null;
    rows.push({ field: "date", current: current ? [current] : [], suggested: [date], newNames: [], changed: current !== date });
  }
  const amount = parseAmount(suggestion.amount);
  if (amount !== null) {
    const current = doc.amount ?? null;
    rows.push({
      field: "amount",
      current: current !== null ? [current.toFixed(2)] : [],
      suggested: [amount.toFixed(2)],
      newNames: [],
      changed: current === null || Math.round(current * 100) !== Math.round(amount * 100),
    });
  }
  return rows;
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
  if (fields.includes("date")) delete next.date;
  if (fields.includes("amount")) delete next.amount;
  if (fields.includes("tags")) {
    const done = new Set(appliedTags.map(norm));
    next.tags = (next.tags ?? []).filter((t) => !done.has(norm(t)));
  }
  const open =
    next.title || next.correspondent || next.documentType || next.tags?.length || next.date || next.amount != null;
  return open ? next : null;
}
