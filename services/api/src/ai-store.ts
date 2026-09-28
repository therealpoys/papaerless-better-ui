import type { MetadataSuggestion } from "@papaerless/shared-types";

/**
 * Vorschläge leben nur im Speicher von services/api (siehe ADR 0001, "DB für
 * Vorschläge"). Bei einem Neustart des Backends gehen unbestätigte Vorschläge
 * verloren – das ist für die Review-Inbox akzeptabel, da sie jederzeit neu
 * angefordert werden können.
 */
const suggestions = new Map<number, MetadataSuggestion>();

export const aiStore = {
  set(suggestion: MetadataSuggestion) {
    suggestions.set(suggestion.documentId, suggestion);
  },
  get(documentId: number) {
    return suggestions.get(documentId);
  },
  delete(documentId: number) {
    suggestions.delete(documentId);
  },
  list() {
    return Array.from(suggestions.values());
  },
};
