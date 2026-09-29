import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { processedStore } from "../src/processed-store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mail-store-"));
  process.env.MAIL_DATA_DIR = path.join(dir, "data");
});

afterEach(async () => {
  delete process.env.MAIL_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("processedStore", () => {
  it("kennt unbekannte IDs nicht, wenn noch keine Datei existiert", async () => {
    expect(await processedStore.has("<a@x>")).toBe(false);
  });

  it("merkt sich IDs persistent und ohne Duplikate", async () => {
    await processedStore.add("<a@x>");
    await processedStore.add("<a@x>");
    await processedStore.add("<b@x>");
    expect(await processedStore.has("<a@x>")).toBe(true);
    expect(await processedStore.has("<b@x>")).toBe(true);
    expect(await processedStore.has("<c@x>")).toBe(false);
  });
});
