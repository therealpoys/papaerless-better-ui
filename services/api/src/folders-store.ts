import type { Folder, FolderCriterion } from "@papaerless/shared-types";
import { readJsonFile, writeJsonFile } from "./json-store.js";

const FILE = "folders.json";

async function load(): Promise<Folder[]> {
  return readJsonFile<Folder[]>(FILE, []);
}

// Es werden nur Ordner-Definitionen gespeichert, keine Dokumente.
export const foldersStore = {
  async list(): Promise<Folder[]> {
    const folders = await load();
    return folders.sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  async add(folder: Folder): Promise<Folder> {
    const folders = await load();
    folders.push(folder);
    await writeJsonFile(FILE, folders);
    return folder;
  },

  /** Benennt um und/oder ändert das Kriterium. Liefert `undefined`, wenn die ID unbekannt ist. */
  async update(
    id: string,
    patch: { name?: string; criterion?: FolderCriterion },
  ): Promise<Folder | undefined> {
    const folders = await load();
    const index = folders.findIndex((f) => f.id === id);
    if (index === -1) return undefined;
    const updated: Folder = {
      ...folders[index],
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.criterion !== undefined ? { criterion: patch.criterion } : {}),
    };
    folders[index] = updated;
    await writeJsonFile(FILE, folders);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const folders = await load();
    await writeJsonFile(FILE, folders.filter((f) => f.id !== id));
  },
};
