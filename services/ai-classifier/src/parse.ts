import { normalizeDate, parseAmount, type MetadataSuggestion } from "@papaerless/shared-types";

interface RawSuggestion {
  title?: string | null;
  correspondent?: string | null;
  documentType?: string | null;
  tags?: string[] | null;
  date?: string | null;
  /** Modelle liefern gern Text wie "1.234,56 €" statt einer Zahl. */
  amount?: number | string | null;
  confidence?: number;
}

export function parseSuggestion(documentId: number, text: string): MetadataSuggestion {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("KI-Antwort enthielt kein JSON-Objekt");
  }

  const raw = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as RawSuggestion;

  return {
    documentId,
    title: raw.title ?? undefined,
    correspondent: raw.correspondent ?? undefined,
    documentType: raw.documentType ?? undefined,
    tags: raw.tags ?? undefined,
    date: normalizeDate(raw.date) ?? undefined,
    amount: parseAmount(raw.amount) ?? undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
  };
}
