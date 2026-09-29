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

    it("meldet UNKNOWN, wenn Paperless die Task nicht kennt oder einen fremden Status liefert", async () => {
      fetchMock.mockResolvedValueOnce(json([]));
      await expect(client.getTask("t")).resolves.toEqual({ status: "UNKNOWN" });

      fetchMock.mockResolvedValueOnce(json([{ status: "REVOKED", related_document: null }]));
      await expect(client.getTask("t")).resolves.toEqual({ status: "UNKNOWN", documentId: undefined });
    });
  });
});
