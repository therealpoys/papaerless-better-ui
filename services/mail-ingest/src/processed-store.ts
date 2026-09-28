import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(here, "../data/processed.json");

async function load(): Promise<string[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as string[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * Verhindert Doppel-Uploads über Neustarts hinweg: hält nur die Message-IDs
 * bereits verarbeiteter Mails (keine eigene Dokumenten-DB, siehe ADR 0002).
 */
export const processedStore = {
  async has(messageId: string): Promise<boolean> {
    const ids = await load();
    return ids.includes(messageId);
  },

  async add(messageId: string): Promise<void> {
    const ids = await load();
    if (ids.includes(messageId)) return;
    ids.push(messageId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(ids, null, 2), "utf-8");
  },
};
