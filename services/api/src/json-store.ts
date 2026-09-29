import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// API_DATA_DIR überschreibt das Standardverzeichnis (v.a. für Tests).
const defaultDataDir = path.resolve(here, "../data");
const getDataDir = () => process.env.API_DATA_DIR ?? defaultDataDir;

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(getDataDir(), fileName), "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(path.join(getDataDir(), fileName), JSON.stringify(data, null, 2), "utf-8");
}
