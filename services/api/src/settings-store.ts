import type { AppSettings } from "@papaerless/shared-types";
import { readJsonFile, writeJsonFile } from "./json-store.js";

const FILE = "settings.json";

interface StoredSettings extends AppSettings {
  /** Höchste Dokument-ID, die der Auto-Vorschlag schon gesehen hat (null = noch nicht initialisiert). */
  autoSuggestAfterId: number | null;
}

const DEFAULTS: StoredSettings = { autoSuggest: false, autoSuggestAfterId: null };

async function load(): Promise<StoredSettings> {
  return { ...DEFAULTS, ...(await readJsonFile<Partial<StoredSettings>>(FILE, {})) };
}

export const settingsStore = {
  async get(): Promise<StoredSettings> {
    return load();
  },

  async update(patch: Partial<StoredSettings>): Promise<StoredSettings> {
    const next = { ...(await load()), ...patch };
    await writeJsonFile(FILE, next);
    return next;
  },
};
