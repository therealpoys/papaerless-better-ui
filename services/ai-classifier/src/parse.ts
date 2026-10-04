import type { MetadataSuggestion } from "@papaerless/shared-types";

interface RawSuggestion {
  title?: string | null;
  correspondent?: string | null;
  documentType?: string | null;
  tags?: string[] | null;
  date?: string | null;
  amount?: number | null;
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
    date: raw.date ?? undefined,
    amount: raw.amount ?? undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
  };
}
