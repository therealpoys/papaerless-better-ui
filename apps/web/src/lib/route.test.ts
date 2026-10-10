import { describe, expect, it } from "vitest";
import { buildPath, parseRoute, type Route } from "./route";

function roundTrip(path: string) {
  const [pathname, search = ""] = path.split("?");
  return buildPath(parseRoute(pathname, search ? `?${search}` : ""));
}

describe("parseRoute", () => {
  it("kennt die einfachen Tabs", () => {
    expect(parseRoute("/", "")).toEqual({ tab: "home" });
    expect(parseRoute("/inbox", "")).toEqual({ tab: "inbox" });
    expect(parseRoute("/help", "")).toEqual({ tab: "help" });
    expect(parseRoute("/trash", "")).toEqual({ tab: "trash" });
    expect(buildPath({ tab: "trash" })).toBe("/trash");
  });

  it("fällt bei unbekannten Pfaden auf die Startseite zurück", () => {
    expect(parseRoute("/gibt-es-nicht", "")).toEqual({ tab: "home" });
  });

  it("liest Dokument-ID, Filter und Seite", () => {
    expect(parseRoute("/documents/42", "?q=Strom&tags=1,2&correspondent=3&type=4&page=2&sort=title&order=asc")).toEqual({
      tab: "documents",
      documentId: 42,
      filters: { query: "Strom", tags: [1, 2], correspondent: 3, documentType: 4, sort: "title", sortOrder: "asc" },
      page: 2,
    });
  });

  it("ignoriert kaputte Werte", () => {
    expect(parseRoute("/documents/abc", "?tags=x,5&page=-1&sort=evil")).toEqual({
      tab: "documents",
      documentId: null,
      filters: { tags: [5] },
      page: 1,
    });
  });

  it("liest Ordner und Dokument im Ordner", () => {
    expect(parseRoute("/folders", "")).toEqual({ tab: "folders", folderId: null, documentId: null });
    expect(parseRoute("/folders/abc", "")).toEqual({ tab: "folders", folderId: "abc", documentId: null });
    expect(parseRoute("/folders/abc/documents/7", "")).toEqual({ tab: "folders", folderId: "abc", documentId: 7 });
  });
});

describe("buildPath", () => {
  it("ist das Gegenstück zu parseRoute", () => {
    for (const path of [
      "/",
      "/settings",
      "/documents",
      "/documents/42",
      "/documents?q=Strom&tags=1%2C2&page=3",
      "/documents/5?correspondent=3&type=4&from=2024-01-01&to=2024-12-31&sort=created&order=desc",
      "/folders",
      "/folders/abc",
      "/folders/abc/documents/7",
    ]) {
      expect(roundTrip(path)).toBe(path);
    }
  });

  it("lässt Seite 1 weg", () => {
    const route: Route = { tab: "documents", documentId: null, filters: {}, page: 1 };
    expect(buildPath(route)).toBe("/documents");
  });
});
