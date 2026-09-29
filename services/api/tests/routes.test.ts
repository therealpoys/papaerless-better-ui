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
}));
vi.mock("../src/paperless.js", () => ({ paperless }));

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
