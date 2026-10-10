import { describe, expect, it } from "vitest";
import { buildSnippet, highlightSegments, queryTerms } from "./snippet";

const plain = (s: { segments: { text: string }[] }) => s.segments.map((x) => x.text).join("");
const matches = (s: { segments: { text: string; match: boolean }[] }) =>
  s.segments.filter((x) => x.match).map((x) => x.text);

describe("queryTerms", () => {
  it("trennt an Leerzeichen und entfernt Duplikate", () => {
    expect(queryTerms("  Strom   rechnung strom ")).toEqual(["Strom", "rechnung"]);
  });
  it("entfernt Anführungszeichen", () => {
    expect(queryTerms('"Strom" „Gas“')).toEqual(["Strom", "Gas"]);
  });
  it("leere Suche ergibt keine Begriffe", () => {
    expect(queryTerms("   ")).toEqual([]);
    expect(queryTerms('""')).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("markiert alle Vorkommen unabhängig von Groß/Klein und behält die Originalschreibweise", () => {
    const seg = highlightSegments("Rechnung und rechnung", "RECHNUNG");
    expect(seg.filter((s) => s.match).map((s) => s.text)).toEqual(["Rechnung", "rechnung"]);
    expect(seg.map((s) => s.text).join("")).toBe("Rechnung und rechnung");
  });
  it("findet Umlaute unabhängig von Groß/Klein", () => {
    const seg = highlightSegments("Kündigung der ÜBERWEISUNG", "überweisung kÜNDIGUNG");
    expect(seg.filter((s) => s.match).map((s) => s.text)).toEqual(["Kündigung", "ÜBERWEISUNG"]);
  });
  it("behandelt Regex-Sonderzeichen wörtlich", () => {
    const seg = highlightSegments("Betrag (10.00) a+b", "(10.00) a+b");
    expect(seg.filter((s) => s.match).map((s) => s.text)).toEqual(["(10.00)", "a+b"]);
  });
  it("ohne Begriffe bleibt der Text unmarkiert", () => {
    expect(highlightSegments("Text", "")).toEqual([{ text: "Text", match: false }]);
  });
  it("leerer Text ergibt keine Segmente", () => {
    expect(highlightSegments("", "x")).toEqual([]);
  });
  it("bevorzugt den längeren Begriff bei Überlappung", () => {
    const seg = highlightSegments("Stromrechnung", "Strom Stromrechnung");
    expect(seg).toEqual([{ text: "Stromrechnung", match: true }]);
  });
});

describe("buildSnippet", () => {
  it("gibt null ohne Treffer, ohne Query oder ohne Inhalt", () => {
    expect(buildSnippet("Hallo Welt", "xyz")).toBeNull();
    expect(buildSnippet("Hallo Welt", "")).toBeNull();
    expect(buildSnippet("Hallo Welt", undefined)).toBeNull();
    expect(buildSnippet("", "Hallo")).toBeNull();
    expect(buildSnippet(null, "Hallo")).toBeNull();
    expect(buildSnippet("Hallo", '""')).toBeNull();
  });

  it("kurzer Text: kein Abschneiden, kein Ellipsis", () => {
    const s = buildSnippet("Die Stromrechnung kam heute.", "strom")!;
    expect(s.truncatedStart).toBe(false);
    expect(s.truncatedEnd).toBe(false);
    expect(plain(s)).toBe("Die Stromrechnung kam heute.");
    expect(matches(s)).toEqual(["Strom"]);
  });

  it("schneidet langen Text um den ersten Treffer zu", () => {
    const content = `${"vorher ".repeat(100)}Kündigung${" nachher".repeat(100)}`;
    const s = buildSnippet(content, "kündigung", 100)!;
    expect(s.truncatedStart).toBe(true);
    expect(s.truncatedEnd).toBe(true);
    expect(matches(s)).toEqual(["Kündigung"]);
    expect(plain(s).length).toBeLessThanOrEqual(9 + 200);
    expect(plain(s).length).toBeGreaterThan(100);
  });

  it("beginnt und endet an Wortgrenzen", () => {
    const content = `${"abcdefghij ".repeat(30)}ZIEL${" klmnopqrst".repeat(30)}`;
    const s = buildSnippet(content, "ziel", 25)!;
    for (const w of plain(s).split(" ")) {
      expect(["abcdefghij", "ZIEL", "klmnopqrst"]).toContain(w);
    }
  });

  it("Treffer am Textanfang: kein Start-Ellipsis", () => {
    const s = buildSnippet(`Rechnung ${"x ".repeat(200)}`, "rechnung")!;
    expect(s.truncatedStart).toBe(false);
    expect(s.truncatedEnd).toBe(true);
  });

  it("Treffer am Textende: kein End-Ellipsis", () => {
    const s = buildSnippet(`${"x ".repeat(200)}Rechnung`, "rechnung")!;
    expect(s.truncatedStart).toBe(true);
    expect(s.truncatedEnd).toBe(false);
  });

  it("normalisiert Zeilenumbrüche und Mehrfachleerzeichen", () => {
    const s = buildSnippet("Zeile eins\n\n  Strom\t\trechnung", "rechnung")!;
    expect(plain(s)).toBe("Zeile eins Strom rechnung");
  });

  it("Mehrwort-Query: alle Begriffe im Ausschnitt werden markiert", () => {
    const s = buildSnippet("Die Miete für Mai wurde per Überweisung bezahlt.", "überweisung miete")!;
    expect(matches(s)).toEqual(["Miete", "Überweisung"]);
  });

  it("findet Umlaute mit abweichender Groß/Kleinschreibung", () => {
    const s = buildSnippet("Beschluss der Gemeinde Köln", "KÖLN")!;
    expect(matches(s)).toEqual(["Köln"]);
  });

  it("ist XSS-sicher: HTML im Inhalt bleibt reiner Text in Segmenten", () => {
    const s = buildSnippet('<img src=x onerror="alert(1)"> Rechnung', "rechnung")!;
    expect(plain(s)).toContain("<img");
    expect(matches(s)).toEqual(["Rechnung"]);
  });

  it("Regex-Sonderzeichen in der Query stürzen nicht ab", () => {
    expect(() => buildSnippet("a (b) [c] *", "(b [c] *")).not.toThrow();
    expect(matches(buildSnippet("a (b) [c] *", "(b")!)).toEqual(["(b"]);
  });
});
