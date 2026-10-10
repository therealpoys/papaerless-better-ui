import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaperlessClient } from "../src/index.js";

const fetchMock = vi.fn();
const client = new PaperlessClient({ baseUrl: "http://p.test", apiToken: "tok" });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("PaperlessClient", () => {
  it("baut die Listen-URL, sendet das Token und mappt snake_case", async () => {
    fetchMock.mockResolvedValue(
      json({
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, title: "T", content: "c", created: "2026-01-01", correspondent: 2, document_type: 3, tags: [4] },
        ],
      }),
    );

    const res = await client.listDocuments({ query: "strom", tags: [1, 2], sort: "created", page: 2 });

    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(url);
    expect(u.pathname).toBe("/api/documents/");
    expect(u.searchParams.get("query")).toBe("strom");
    expect(u.searchParams.getAll("tags__id__in")).toEqual(["1", "2"]);
    expect(u.searchParams.get("ordering")).toBe("-created");
    expect(u.searchParams.get("page")).toBe("2");
    expect(init.headers.Authorization).toBe("Token tok");
    expect(res).toEqual({
      count: 1,
      page: 2,
      pageSize: 25,
      results: [{ id: 1, title: "T", content: "c", created: "2026-01-01", correspondent: 2, documentType: 3, tags: [4] }],
    });
  });

  it("sortiert Titel standardmäßig aufsteigend", async () => {
    fetchMock.mockResolvedValue(json({ count: 0, next: null, previous: null, results: [] }));
    await client.listDocuments({ sort: "title" });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("ordering")).toBe("title");
  });

  it("wirft bei Fehlerstatus mit Status und Pfad", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(client.getDocument(9)).rejects.toThrow(/\/api\/documents\/9\/.*Status 500/);
  });

  it("mappt Updates auf document_type und sendet nur gesetzte Felder", async () => {
    fetchMock.mockResolvedValue(
      json({ id: 1, title: "N", content: "", created: "", correspondent: null, document_type: 5, tags: [] }),
    );
    await client.updateDocument(1, { title: "N", documentType: 5 });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ title: "N", document_type: 5 });
  });

  it("schickt bulk_edit mit passenden parameters", async () => {
    fetchMock.mockResolvedValue(json({ result: "OK" }));
    await client.bulkEditDocuments([1, 2], { method: "add_tag", tag: 7 } as never);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      documents: [1, 2],
      method: "add_tag",
      parameters: { tag: 7 },
    });
  });

  it("liest den Dateinamen aus Content-Disposition beim Download", async () => {
    fetchMock.mockResolvedValue(
      new Response("pdf", {
        headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="Rechnung.pdf"` },
      }),
    );
    const d = await client.downloadDocument(3);
    expect(d.fileName).toBe("Rechnung.pdf");
    expect(d.contentType).toBe("application/pdf");
  });

  it("fällt beim Download ohne Header auf Platzhalter zurück", async () => {
    fetchMock.mockResolvedValue(new Response("x"));
    expect((await client.downloadDocument(3)).fileName).toBe("dokument-3");
  });

  it("lädt das Thumbnail über /thumb/ und wirft bei Fehlern", async () => {
    fetchMock.mockResolvedValueOnce(new Response("img", { headers: { "content-type": "image/webp" } }));
    const t = await client.getThumbnail(3);
    expect(t.contentType).toBe("image/webp");
    expect(fetchMock.mock.calls[0][0]).toBe("http://p.test/api/documents/3/thumb/");
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    await expect(client.getThumbnail(3)).rejects.toThrow(/Paperless-Status 404/);
  });

  it("liefert die Task-ID beim Upload und wirft bei Fehlern", async () => {
    fetchMock.mockResolvedValueOnce(json("task-uuid"));
    expect(await client.uploadDocument(new Blob(["x"]), "a.pdf")).toBe("task-uuid");
    fetchMock.mockResolvedValueOnce(new Response("bad", { status: 400 }));
    await expect(client.uploadDocument(new Blob(["x"]), "a.pdf")).rejects.toThrow(/Upload fehlgeschlagen \(Paperless-Status 400\)/);
  });

  describe("getTask", () => {
    it("liefert bei SUCCESS die Dokument-ID als Zahl", async () => {
      fetchMock.mockResolvedValue(json([{ status: "SUCCESS", related_document: "42" }]));

      await expect(client.getTask("abc-123")).resolves.toEqual({ status: "SUCCESS", documentId: 42 });
      expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("task_id")).toBe("abc-123");
    });

    it("liefert bei laufendem Vorgang keine Dokument-ID", async () => {
      fetchMock.mockResolvedValue(json([{ status: "STARTED", related_document: null }]));

      await expect(client.getTask("t")).resolves.toEqual({ status: "STARTED", documentId: undefined });
    });

    it("versteht das neuere Format (API v10): results, kleiner Status, related_document_ids", async () => {
      fetchMock.mockResolvedValue(
        json({ count: 1, results: [{ status: "success", related_document_ids: [16], result_data: { document_id: 16 } }] }),
      );

      await expect(client.getTask("t")).resolves.toEqual({ status: "SUCCESS", documentId: 16 });
    });

    it("nimmt im neueren Format notfalls die ID aus result_data", async () => {
      fetchMock.mockResolvedValue(
        json({ results: [{ status: "success", related_document_ids: [], result_data: { document_id: 8 } }] }),
      );

      await expect(client.getTask("t")).resolves.toEqual({ status: "SUCCESS", documentId: 8 });
    });

    it("meldet im neueren Format einen Fehlschlag", async () => {
      fetchMock.mockResolvedValue(json({ results: [{ status: "failure", related_document_ids: [] }] }));

      await expect(client.getTask("t")).resolves.toEqual({ status: "FAILURE", documentId: undefined });
    });

    it("meldet UNKNOWN, wenn Paperless die Task nicht kennt oder einen fremden Status liefert", async () => {
      fetchMock.mockResolvedValueOnce(json([]));
      await expect(client.getTask("t")).resolves.toEqual({ status: "UNKNOWN" });
      fetchMock.mockResolvedValueOnce(json({ count: 0, results: [] }));
      await expect(client.getTask("t")).resolves.toEqual({ status: "UNKNOWN" });

      fetchMock.mockResolvedValueOnce(json([{ status: "REVOKED", related_document: null }]));
      await expect(client.getTask("t")).resolves.toEqual({ status: "UNKNOWN", documentId: undefined });
    });
  });

  describe("Papierkorb", () => {
    const raw = (id: number) => ({
      id,
      title: `T${id}`,
      content: "",
      created: "2026-01-01",
      correspondent: null,
      document_type: null,
      tags: [],
      deleted_at: "2026-02-01T10:00:00+01:00",
    });

    it("listet alle Seiten und mappt deleted_at", async () => {
      fetchMock
        .mockResolvedValueOnce(json({ count: 2, next: "x", previous: null, results: [raw(1)] }))
        .mockResolvedValueOnce(json({ count: 2, next: null, previous: null, results: [raw(2)] }));
      const res = await client.listTrash();
      expect(res.map((d) => [d.id, d.deletedAt])).toEqual([
        [1, "2026-02-01T10:00:00+01:00"],
        [2, "2026-02-01T10:00:00+01:00"],
      ]);
      expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("page")).toBe("2");
    });

    it("stellt wieder her und löscht endgültig per POST /api/trash/", async () => {
      fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
      await client.restoreFromTrash([5, 6]);
      await client.deleteFromTrash([7]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(new URL(url).pathname).toBe("/api/trash/");
      expect(JSON.parse(init.body)).toEqual({ documents: [5, 6], action: "restore" });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ documents: [7], action: "empty" });
    });

    it("sendet bei leerer ID-Liste nichts (Paperless würde sonst 'alle' verstehen)", async () => {
      await client.deleteFromTrash([]);
      await client.restoreFromTrash([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("leert den Papierkorb über explizite IDs und meldet die Anzahl", async () => {
      fetchMock
        .mockResolvedValueOnce(json({ count: 2, next: null, previous: null, results: [raw(1), raw(2)] }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      await expect(client.emptyTrash()).resolves.toBe(2);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ documents: [1, 2], action: "empty" });
    });

    it("wirft bei Fehlern einen PaperlessError", async () => {
      fetchMock.mockResolvedValue(new Response("nope", { status: 403 }));
      await expect(client.restoreFromTrash([1])).rejects.toMatchObject({ status: 403 });
    });
  });
});
