import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMonetary, parseMonetary, PaperlessClient } from "../src/index.js";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = (results: unknown[], next: string | null = null) => ({ count: results.length, next, previous: null, results });
const fields = (...names: string[]) => page(names.map((name, i) => ({ id: 10 + i, name, data_type: "monetary" })));
const rawDoc = (extra: object = {}) => ({
  id: 1,
  title: "T",
  content: "",
  created: "2026-01-02",
  correspondent: 2,
  document_type: 3,
  tags: [],
  ...extra,
});

let client: PaperlessClient;
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  client = new PaperlessClient({ baseUrl: "http://p.test", apiToken: "tok" });
});
afterEach(() => vi.unstubAllGlobals());

describe("Monetary-Format", () => {
  it("schreibt und liest EUR12.50", () => {
    expect(formatMonetary(12.5)).toBe("EUR12.50");
    expect(parseMonetary("EUR1234.50")).toBe(1234.5);
    expect(parseMonetary("")).toBeNull();
    expect(parseMonetary(null)).toBeNull();
    expect(parseMonetary(7)).toBe(7);
  });
});

describe("ensureAmountField", () => {
  it("legt das Feld an, wenn es fehlt (monetary, EUR)", async () => {
    fetchMock.mockResolvedValueOnce(json(fields("Anderes"))).mockResolvedValueOnce(json({ id: 42, name: "Betrag", data_type: "monetary" }));
    expect(await client.ensureAmountField()).toBe(42);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://p.test/api/custom_fields/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Betrag", data_type: "monetary", extra_data: { default_currency: "EUR" } });
  });

  it("ist idempotent: vorhandenes Feld wird wiederverwendet und gecacht", async () => {
    fetchMock.mockResolvedValueOnce(json(fields("betrag")));
    expect(await client.ensureAmountField()).toBe(10);
    expect(await client.ensureAmountField()).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
  });

  it("nimmt bei einem Anlege-Konflikt das parallel erzeugte Feld", async () => {
    fetchMock
      .mockResolvedValueOnce(json(fields()))
      .mockResolvedValueOnce(new Response("exists", { status: 400 }))
      .mockResolvedValueOnce(json(fields("Betrag")));
    expect(await client.ensureAmountField()).toBe(10);
  });
});

describe("Betrag und Datum lesen/schreiben", () => {
  it("liest den Betrag aus custom_fields", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page([rawDoc({ custom_fields: [{ field: 10, value: "EUR89.50" }] }), rawDoc({ id: 2 })])))
      .mockResolvedValueOnce(json(fields("Betrag")));
    const res = await client.listDocuments();
    expect(res.results[0].amount).toBe(89.5);
    expect(res.results[1].amount).toBeUndefined();
  });

  it("fragt Custom Fields nicht ab, wenn kein Dokument welche hat", async () => {
    fetchMock.mockResolvedValueOnce(json(page([rawDoc({ custom_fields: [] })])));
    await client.listDocuments();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("PATCH sendet created und Betrag und erhält fremde Custom Fields", async () => {
    fetchMock
      .mockResolvedValueOnce(json(fields("Betrag"))) // ensure
      .mockResolvedValueOnce(json(rawDoc({ custom_fields: [{ field: 99, value: "x" }, { field: 10, value: "EUR1.00" }] })))
      .mockResolvedValueOnce(json(rawDoc({ created: "2026-05-01", custom_fields: [{ field: 99, value: "x" }, { field: 10, value: "EUR89.50" }] })));
    const doc = await client.updateDocument(1, { created: "2026-05-01", amount: 89.5 });
    const patch = fetchMock.mock.calls[2];
    expect(patch[1].method).toBe("PATCH");
    expect(JSON.parse(patch[1].body)).toEqual({
      created: "2026-05-01",
      custom_fields: [
        { field: 99, value: "x" },
        { field: 10, value: "EUR89.50" },
      ],
    });
    expect(doc.amount).toBe(89.5);
  });

  it("amount: null entfernt nur das Betragsfeld", async () => {
    fetchMock
      .mockResolvedValueOnce(json(fields("Betrag")))
      .mockResolvedValueOnce(json(rawDoc({ custom_fields: [{ field: 99, value: "x" }, { field: 10, value: "EUR1.00" }] })))
      .mockResolvedValueOnce(json(rawDoc({ custom_fields: [{ field: 99, value: "x" }] })))
      .mockResolvedValueOnce(json(fields("Betrag")));
    await client.updateDocument(1, { amount: null });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ custom_fields: [{ field: 99, value: "x" }] });
  });

  it("PATCH ohne Betrag fasst Custom Fields nicht an", async () => {
    fetchMock.mockResolvedValueOnce(json(rawDoc()));
    await client.updateDocument(1, { title: "N" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: "N" });
  });
});

describe("listExpenseDocuments", () => {
  it("filtert nach Betragsfeld und Zeitraum und blättert durch", async () => {
    fetchMock
      .mockResolvedValueOnce(json(fields("Betrag")))
      .mockResolvedValueOnce(json(page([rawDoc({ id: 1, custom_fields: [{ field: 10, value: "EUR10.00" }] })], "http://p.test/next")))
      .mockResolvedValueOnce(json(page([rawDoc({ id: 2, custom_fields: [{ field: 10, value: "EUR5.25" }] }), rawDoc({ id: 3 })])));
    const docs = await client.listExpenseDocuments({ dateFrom: "2026-01-01", dateTo: "2026-12-31" });
    expect(docs.map((d) => [d.id, d.amount])).toEqual([
      [1, 10],
      [2, 5.25],
    ]);
    const u = new URL(fetchMock.mock.calls[1][0]);
    expect(u.searchParams.get("custom_fields__id__all")).toBe("10");
    expect(u.searchParams.get("created__date__gte")).toBe("2026-01-01");
    expect(u.searchParams.get("created__date__lte")).toBe("2026-12-31");
    expect(new URL(fetchMock.mock.calls[2][0]).searchParams.get("page")).toBe("2");
  });

  it("liefert leer, wenn es das Feld noch nicht gibt (und legt es nicht an)", async () => {
    fetchMock.mockResolvedValueOnce(json(fields()));
    expect(await client.listExpenseDocuments()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
