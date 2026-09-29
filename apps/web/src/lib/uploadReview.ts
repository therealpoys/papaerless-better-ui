import type { Correspondent, DocumentType, MetadataSuggestion, Tag } from "@papaerless/shared-types";

/** Auswahl im Prüf-Fenster: vorhandener Eintrag (Zahl), neuer Name (Text) oder nichts (null). */
export type Choice = number | string | null;

export interface ReviewForm {
  title: string;
  correspondent: Choice;
  documentType: Choice;
  /** Vorhandene Schlagwörter als IDs, neue als Namen. */
  tags: (number | string)[];
}

interface Known {
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
}

function findByName<T extends { id: number; name: string }>(items: T[], name: string): T | undefined {
  const wanted = name.trim().toLowerCase();
  return items.find((item) => item.name.trim().toLowerCase() === wanted);
}

function choiceFor(name: string | undefined, items: { id: number; name: string }[]): Choice {
  if (!name?.trim()) return null;
  return findByName(items, name)?.id ?? name.trim();
}

/** Macht aus einem KI-Vorschlag die Vorbelegung des Formulars (bekannte Namen werden zu IDs). */
export function formFromSuggestion(
  suggestion: MetadataSuggestion | undefined,
  known: Known,
  fallbackTitle: string,
): ReviewForm {
  const tags: (number | string)[] = [];
  for (const name of suggestion?.tags ?? []) {
    const value = findByName(known.tags, name)?.id ?? name.trim();
    const seen = tags.some((t) => (typeof t === "string" && typeof value === "string" ? t.toLowerCase() === value.toLowerCase() : t === value));
    if (value !== "" && !seen) tags.push(value);
  }
  return {
    title: suggestion?.title?.trim() || fallbackTitle,
    correspondent: choiceFor(suggestion?.correspondent, known.correspondents),
    documentType: choiceFor(suggestion?.documentType, known.documentTypes),
    tags,
  };
}

interface SaveDeps {
  createCorrespondent: (name: string) => Promise<{ id: number }>;
  createDocumentType: (name: string) => Promise<{ id: number }>;
  createTag: (name: string) => Promise<{ id: number }>;
  updateDocument: (
    id: number,
    patch: { title: string; correspondent: number | null; documentType: number | null; tags: number[] },
  ) => Promise<unknown>;
}

/** Legt neue Einträge an (nur wenn ausgewählt) und speichert die Angaben am Dokument. */
export async function saveReview(deps: SaveDeps, documentId: number, form: ReviewForm): Promise<void> {
  const resolve = async (choice: Choice, create: (name: string) => Promise<{ id: number }>) =>
    typeof choice === "string" ? (await create(choice)).id : choice;

  const correspondent = await resolve(form.correspondent, deps.createCorrespondent);
  const documentType = await resolve(form.documentType, deps.createDocumentType);
  const tags: number[] = [];
  for (const tag of form.tags) {
    const id = await resolve(tag, deps.createTag);
    if (id !== null && !tags.includes(id)) tags.push(id);
  }

  await deps.updateDocument(documentId, {
    title: form.title.trim() || String(documentId),
    correspondent,
    documentType,
    tags,
  });
}

/** Macht aus einem Dateinamen einen lesbaren Titel (ohne Endung, ohne Hash samt Anhang dahinter, ohne Unterstriche). */
export function cleanTitle(fileName: string): string {
  return fileName
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[_-]?[0-9a-f]{16,}.*$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mentions(text: string, name: string): boolean {
  const n = name.trim().toLowerCase();
  return n.length >= 3 && text.includes(n);
}

/**
 * Einfache Erkennung ohne KI: Titel aus der ersten Textzeile, Absender/Art/Schlagwörter, deren
 * Name im erkannten Text vorkommt. Liefert nie einen erfundenen Wert, nur vorhandene Einträge.
 */
export function heuristicSuggestion(
  doc: { id: number; content: string },
  fileName: string,
  known: Known,
): MetadataSuggestion {
  const text = doc.content.toLowerCase();
  const firstLine = doc.content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 5);
  const title = firstLine && firstLine.length <= 80 ? firstLine : cleanTitle(fileName);

  return {
    documentId: doc.id,
    title,
    correspondent: known.correspondents.find((c) => mentions(text, c.name))?.name,
    documentType: known.documentTypes.find((t) => mentions(text, t.name))?.name,
    tags: known.tags.filter((t) => mentions(text, t.name)).map((t) => t.name),
    confidence: 0.5,
  };
}

/**
 * Die Auswahlliste kennt nur Zahlen. Neue (noch nicht angelegte) Namen bekommen deshalb negative
 * IDs: -1 für den ersten Namen in `extras`, -2 für den zweiten usw.
 */
export function comboIdFromChoice(choice: Choice, extras: string[]): number | null {
  if (typeof choice !== "string") return choice;
  const index = extras.indexOf(choice);
  return index < 0 ? null : -(index + 1);
}

export function choiceFromComboId(id: number | null, extras: string[]): Choice {
  if (id === null) return null;
  return id < 0 ? (extras[-id - 1] ?? null) : id;
}
