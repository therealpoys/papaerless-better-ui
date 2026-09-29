import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { MetadataSuggestion, Reminder } from "@papaerless/shared-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aiStore } from "../src/ai-store.js";
import { readJsonFile, writeJsonFile } from "../src/json-store.js";
import { remindersStore } from "../src/reminders-store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "api-store-"));
  process.env.API_DATA_DIR = dir;
});

afterEach(async () => {
  delete process.env.API_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("json-store", () => {
  it("liefert den Fallback, wenn die Datei fehlt", async () => {
    expect(await readJsonFile("missing.json", ["x"])).toEqual(["x"]);
  });

  it("schreibt und liest JSON und legt das Verzeichnis an", async () => {
    process.env.API_DATA_DIR = path.join(dir, "nested");
    await writeJsonFile("a.json", { a: 1 });
    expect(await readJsonFile("a.json", null)).toEqual({ a: 1 });
    expect(JSON.parse(await readFile(path.join(dir, "nested", "a.json"), "utf-8"))).toEqual({ a: 1 });
  });
});

describe("aiStore", () => {
  const s = (documentId: number, title: string): MetadataSuggestion => ({
    documentId,
    title,
    confidence: 0.9,
  });

  it("setzt, liest, ersetzt und löscht Vorschläge", async () => {
    expect(await aiStore.list()).toEqual([]);
    await aiStore.set(s(1, "A"));
    await aiStore.set(s(2, "B"));
    await aiStore.set(s(1, "A2"));

    expect((await aiStore.get(1))?.title).toBe("A2");
    expect(await aiStore.list()).toHaveLength(2);

    await aiStore.delete(1);
    expect(await aiStore.get(1)).toBeUndefined();
    expect(await aiStore.list()).toHaveLength(1);
  });
});

describe("remindersStore", () => {
  const r = (id: string, dueDate: string): Reminder =>
    ({ id, documentId: 1, documentTitle: "Doc", kind: "deadline", dueDate }) as Reminder;

  it("sortiert nach Fälligkeit, entfernt und markiert als benachrichtigt", async () => {
    await remindersStore.add(r("b", "2026-06-01"));
    await remindersStore.add(r("a", "2026-01-01"));

    expect((await remindersStore.list()).map((x) => x.id)).toEqual(["a", "b"]);

    await remindersStore.markNotified("a", "2026-01-02T00:00:00Z");
    expect((await remindersStore.list())[0].notifiedAt).toBe("2026-01-02T00:00:00Z");

    await remindersStore.remove("a");
    expect((await remindersStore.list()).map((x) => x.id)).toEqual(["b"]);
  });
});
