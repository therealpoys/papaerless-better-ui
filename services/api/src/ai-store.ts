import type { MetadataSuggestion } from "@papaerless/shared-types";
import { readJsonFile, writeJsonFile } from "./json-store.js";

const FILE = "ai-suggestions.json";

async function load(): Promise<MetadataSuggestion[]> {
  return readJsonFile<MetadataSuggestion[]>(FILE, []);
}

export const aiStore = {
  async set(suggestion: MetadataSuggestion): Promise<void> {
    const suggestions = await load();
    const next = suggestions.filter((s) => s.documentId !== suggestion.documentId);
    next.push(suggestion);
    await writeJsonFile(FILE, next);
  },

  async get(documentId: number): Promise<MetadataSuggestion | undefined> {
    const suggestions = await load();
    return suggestions.find((s) => s.documentId === documentId);
  },

  async delete(documentId: number): Promise<void> {
    const suggestions = await load();
    await writeJsonFile(FILE, suggestions.filter((s) => s.documentId !== documentId));
  },

  async list(): Promise<MetadataSuggestion[]> {
    return load();
  },
};
