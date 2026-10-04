import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paperless = vi.hoisted(() => ({
  getDocument: vi.fn(),
  listTags: vi.fn(),
  createTag: vi.fn(),
  getTask: vi.fn(),
  getThumbnail: vi.fn(),
}));
vi.mock("../src/paperless.js", () => ({ paperless }));

import { backupRoutes } from "../src/routes/backup.js";
import { folderRoutes } from "../src/routes/folders.js";
import { documentRoutes } from "../src/routes/documents.js";
import { metadataRoutes } from "../src/routes/metadata.js";
import { reminderRoutes } from "../src/routes/reminders.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "api-routes-"));
  process.env.API_DATA_DIR = dir;
  vi.resetAllMocks();
});

afterEach(async () => {
  delete process.env.API_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function build() {
  const app = Fastify();
  await app.register(metadataRoutes, { prefix: "/api" });
  await app.register(reminderRoutes, { prefix: "/api" });
  await app.register(folderRoutes, { prefix: "/api" });
  await app.register(backupRoutes, { prefix: "/api" });
  await app.register(documentRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("metadataRoutes", () => {
  it("reicht Tags aus Paperless durch", async () => {
    paperless.listTags.mockResolvedValue([{ id: 1, name: "Rechnung" }]);
    const res = await (await build()).inject({ method: "GET", url: "/api/tags" });
    expect(res.json()).toEqual([{ id: 1, name: "Rechnung" }]);
  });

  it("validiert den Namen beim Anlegen", async () => {
    const app = await build();
    const bad = await app.inject({ method: "POST", url: "/api/tags", payload: { name: "  " } });
    expect(bad.statusCode).toBe(400);
    expect(paperless.createTag).not.toHaveBeenCalled();

    paperless.createTag.mockResolvedValue({ id: 5, name: "Neu" });
    const ok = await app.inject({ method: "POST", url: "/api/tags", payload: { name: " Neu " } });
    expect(ok.json()).toEqual({ id: 5, name: "Neu" });
    expect(paperless.createTag).toHaveBeenCalledWith("Neu");
  });
});

describe("reminderRoutes", () => {
  it("lehnt unvollständige Erinnerungen ab", async () => {
    const res = await (await build()).inject({
      method: "POST",
      url: "/api/reminders",
      payload: { documentId: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("legt Erinnerungen mit Dokumenttitel an, listet und verwirft sie", async () => {
    paperless.getDocument.mockResolvedValue({ id: 7, title: "Mietvertrag" });
    const app = await build();

    const created = await app.inject({
      method: "POST",
      url: "/api/reminders",
      payload: { documentId: 7, kind: "deadline", dueDate: "2026-12-01" },
    });
    expect(created.statusCode).toBe(200);
    const reminder = created.json();
    expect(reminder.documentTitle).toBe("Mietvertrag");
    expect(reminder.id).toBeTruthy();

    expect((await app.inject({ method: "GET", url: "/api/reminders" })).json()).toHaveLength(1);

    await app.inject({ method: "POST", url: `/api/reminders/${reminder.id}/dismiss` });
    expect((await app.inject({ method: "GET", url: "/api/reminders" })).json()).toEqual([]);
  });
});

describe("documentRoutes: Upload-Status", () => {
  it("liefert den Status des Einlese-Vorgangs samt Dokument-ID", async () => {
    paperless.getTask.mockResolvedValue({ status: "SUCCESS", documentId: 42 });

    const res = await (await build()).inject({ method: "GET", url: "/api/documents/tasks/abc-123" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "SUCCESS", documentId: 42 });
    expect(paperless.getTask).toHaveBeenCalledWith("abc-123");
  });

  it("wird nicht mit /documents/:id verwechselt", async () => {
    paperless.getTask.mockResolvedValue({ status: "PENDING" });
    paperless.getDocument.mockResolvedValue({ id: 1 });

    await (await build()).inject({ method: "GET", url: "/api/documents/tasks/xyz" });

    expect(paperless.getTask).toHaveBeenCalledTimes(1);
    expect(paperless.getDocument).not.toHaveBeenCalled();
  });
});

describe("folderRoutes", () => {
  const tag = { kind: "tag", id: 3 };

  it("legt Ordner an (Name getrimmt), listet, benennt um und löscht", async () => {
    const app = await build();
    const created = await app.inject({
      method: "POST",
      url: "/api/folders",
      payload: { name: "  Auto  ", criterion: tag },
    });
    expect(created.statusCode).toBe(200);
    const folder = created.json();
    expect(folder).toMatchObject({ name: "Auto", criterion: tag });
    expect(folder.id).toBeTruthy();

    expect((await app.inject({ method: "GET", url: "/api/folders" })).json()).toHaveLength(1);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/folders/${folder.id}`,
      payload: { name: "KFZ", criterion: { kind: "documentType", id: 2 } },
    });
    expect(patched.json()).toMatchObject({ id: folder.id, name: "KFZ", criterion: { kind: "documentType", id: 2 } });

    const del = await app.inject({ method: "DELETE", url: `/api/folders/${folder.id}` });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/api/folders" })).json()).toEqual([]);
  });

  it("lehnt ungültige Anlage ab", async () => {
    const app = await build();
    const post = (payload: unknown) => app.inject({ method: "POST", url: "/api/folders", payload: payload as object });
    expect((await post({ name: "   ", criterion: tag })).statusCode).toBe(400);
    expect((await post({ name: "x".repeat(61), criterion: tag })).statusCode).toBe(400);
    expect((await post({ name: "A" })).statusCode).toBe(400);
    expect((await post({ name: "A", criterion: { kind: "folder", id: 1 } })).statusCode).toBe(400);
    expect((await post({ name: "A", criterion: { kind: "tag", id: "1" } })).statusCode).toBe(400);
    expect((await post({ name: "A", criterion: { kind: "tag", id: 0 } })).statusCode).toBe(400);
    expect((await post({ name: "x".repeat(60), criterion: tag })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/folders" })).json()).toHaveLength(1);
  });

  it("PATCH: 404 bei unbekannter ID, 400 bei ungültigen Werten", async () => {
    const app = await build();
    const unknown = await app.inject({ method: "PATCH", url: "/api/folders/nope", payload: { name: "X" } });
    expect(unknown.statusCode).toBe(404);

    const { id } = (
      await app.inject({ method: "POST", url: "/api/folders", payload: { name: "A", criterion: tag } })
    ).json();
    const patch = (payload: object) => app.inject({ method: "PATCH", url: `/api/folders/${id}`, payload });
    expect((await patch({ name: " " })).statusCode).toBe(400);
    expect((await patch({ criterion: { kind: "x", id: 1 } })).statusCode).toBe(400);
  });

  it("DELETE ist auch bei unbekannter ID 204", async () => {
    const res = await (await build()).inject({ method: "DELETE", url: "/api/folders/nope" });
    expect(res.statusCode).toBe(204);
  });
});

describe("documentRoutes: Thumbnail", () => {
  it("liefert das Vorschaubild mit Original-Content-Type und Cache-Header", async () => {
    paperless.getThumbnail.mockResolvedValue({ buffer: new Uint8Array([1, 2, 3]).buffer, contentType: "image/webp" });
    const res = await (await build()).inject({ method: "GET", url: "/api/documents/5/thumbnail" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/webp");
    expect(res.headers["cache-control"]).toBe("private, max-age=3600");
    expect([...res.rawPayload]).toEqual([1, 2, 3]);
    expect(paperless.getThumbnail).toHaveBeenCalledWith(5);
  });
});

describe("backupRoutes", () => {
  it("enthält Ordner im Export", async () => {
    const app = await build();
    await app.inject({
      method: "POST",
      url: "/api/folders",
      payload: { name: "Auto", criterion: { kind: "tag", id: 3 } },
    });
    const res = await app.inject({ method: "GET", url: "/api/backup/export" });
    expect(res.json().folders).toMatchObject([{ name: "Auto", criterion: { kind: "tag", id: 3 } }]);
  });
});
