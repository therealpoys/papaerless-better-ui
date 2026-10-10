import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const paperless = vi.hoisted(() => ({
  listTrash: vi.fn(),
  restoreFromTrash: vi.fn(),
  deleteFromTrash: vi.fn(),
  emptyTrash: vi.fn(),
}));
vi.mock("../src/paperless.js", () => ({ paperless }));
vi.mock("../src/env.js", () => ({ env: { trashRetentionDays: 30 } }));

import { trashRoutes } from "../src/routes/trash.js";

async function build() {
  const app = Fastify();
  await app.register(trashRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

beforeEach(() => vi.resetAllMocks());

describe("trashRoutes", () => {
  it("liefert Papierkorb und Frist", async () => {
    paperless.listTrash.mockResolvedValue([{ id: 1, title: "A", deletedAt: "2026-01-01T00:00:00Z" }]);
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/trash" });
    expect(res.json()).toEqual({
      results: [{ id: 1, title: "A", deletedAt: "2026-01-01T00:00:00Z" }],
      retentionDays: 30,
    });
    expect((await app.inject({ method: "GET", url: "/api/trash/info" })).json()).toEqual({ retentionDays: 30 });
  });

  it("stellt wieder her und löscht endgültig", async () => {
    const app = await build();
    const restore = await app.inject({ method: "POST", url: "/api/trash/restore", payload: { documentIds: [1, 2] } });
    expect(restore.statusCode).toBe(204);
    expect(paperless.restoreFromTrash).toHaveBeenCalledWith([1, 2]);

    const del = await app.inject({ method: "POST", url: "/api/trash/delete", payload: { documentIds: [3] } });
    expect(del.statusCode).toBe(204);
    expect(paperless.deleteFromTrash).toHaveBeenCalledWith([3]);
  });

  it("lehnt leere oder ungültige ID-Listen ab (nie implizit 'alle')", async () => {
    const app = await build();
    for (const payload of [{}, { documentIds: [] }, { documentIds: ["1"] }, { documentIds: [0] }, { documentIds: [1.5] }]) {
      const res = await app.inject({ method: "POST", url: "/api/trash/delete", payload });
      expect(res.statusCode).toBe(400);
    }
    expect(paperless.deleteFromTrash).not.toHaveBeenCalled();
  });

  it("leert den Papierkorb", async () => {
    paperless.emptyTrash.mockResolvedValue(4);
    const res = await (await build()).inject({ method: "POST", url: "/api/trash/empty" });
    expect(res.json()).toEqual({ deleted: 4 });
  });
});
