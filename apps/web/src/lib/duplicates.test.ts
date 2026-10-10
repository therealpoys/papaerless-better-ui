import { describe, expect, it, vi } from "vitest";
import { findDuplicate, md5Hex } from "./duplicates";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("md5Hex", () => {
  it("liefert die bekannten Testvektoren", () => {
    expect(md5Hex(bytes(""))).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5Hex(bytes("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5Hex(bytes("The quick brown fox jumps over the lazy dog"))).toBe("9e107d9d372bb6826bd81d3542a419d6");
  });

  it("kommt mit Längen über einem Block zurecht", () => {
    expect(md5Hex(bytes("a".repeat(1000)))).toBe("cabe45dcc9ae5b66ba86600cca6b8ba8");
  });
});

describe("findDuplicate", () => {
  const file = { arrayBuffer: async () => bytes("abc").buffer as ArrayBuffer };

  it("fragt mit der MD5-Prüfsumme der Datei ab", async () => {
    const lookup = vi.fn().mockResolvedValue({ id: 3, title: "Rechnung" });
    await expect(findDuplicate(file, { lookup })).resolves.toEqual({ id: 3, title: "Rechnung" });
    expect(lookup).toHaveBeenCalledWith("900150983cd24fb0d6963f7d28e17f72");
  });

  it("liefert null ohne Treffer", async () => {
    await expect(findDuplicate(file, { lookup: async () => null })).resolves.toBeNull();
  });

  it("blockiert den Upload nicht, wenn die Abfrage fehlschlägt", async () => {
    await expect(findDuplicate(file, { lookup: async () => Promise.reject(new Error("x")) })).resolves.toBeNull();
  });
});
