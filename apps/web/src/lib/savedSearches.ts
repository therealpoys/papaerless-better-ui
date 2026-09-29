import type { DocumentSearchParams } from "@papaerless/shared-types";

// Rein lokal (localStorage), bewusst ohne Backend: pro Browser, keine Synchronisation.
const SAVED_KEY = "papaerless.savedSearches";
const RECENT_KEY = "papaerless.recentSearches";
const MAX_RECENT = 5;

export interface SavedSearch {
  id: string;
  name: string;
  params: DocumentSearchParams;
}

function read<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll/gesperrt (z.B. Privatmodus): Feature degradiert still.
  }
}

/** Seiten-/Paging-Felder gehören nicht zur "Suche". */
export function normalizeParams(params: DocumentSearchParams): DocumentSearchParams {
  const { page: _page, pageSize: _pageSize, ...rest } = params;
  return Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)),
  ) as DocumentSearchParams;
}

export function isEmptySearch(params: DocumentSearchParams): boolean {
  const n = normalizeParams(params);
  // Reine Sortierung zählt nicht als Suche.
  return Object.keys(n).filter((k) => k !== "sort" && k !== "sortOrder").length === 0;
}

const sameSearch = (a: DocumentSearchParams, b: DocumentSearchParams) =>
  JSON.stringify(normalizeParams(a)) === JSON.stringify(normalizeParams(b));

export const listSaved = () => read<SavedSearch>(SAVED_KEY);
export const listRecent = () => read<DocumentSearchParams>(RECENT_KEY);

export function saveSearch(name: string, params: DocumentSearchParams): SavedSearch[] {
  const next = [
    ...listSaved().filter((s) => s.name !== name),
    { id: `${Date.now()}`, name, params: normalizeParams(params) },
  ];
  write(SAVED_KEY, next);
  return next;
}

export function deleteSaved(id: string): SavedSearch[] {
  const next = listSaved().filter((s) => s.id !== id);
  write(SAVED_KEY, next);
  return next;
}

export function pushRecent(params: DocumentSearchParams): DocumentSearchParams[] {
  if (isEmptySearch(params)) return listRecent();
  const n = normalizeParams(params);
  const next = [n, ...listRecent().filter((r) => !sameSearch(r, n))].slice(0, MAX_RECENT);
  write(RECENT_KEY, next);
  return next;
}

export const clearRecent = (): void => write(RECENT_KEY, []);
