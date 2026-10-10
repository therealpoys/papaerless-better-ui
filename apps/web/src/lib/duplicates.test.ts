import { describe, expect, it, vi } from "vitest";
import { findDuplicate, md5Hex, sha256Hex } from "./duplicates";

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

describe("sha256Hex", () => {
  it("liefert bekannte Testvektoren", async () => {
    expect(await sha256Hex(bytes("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("findDuplicate", () => {
  const file = { arrayBuffer: async () => bytes("abc").buffer as ArrayBuffer };

  it("fragt zuerst mit der SHA-256-Prüfsumme ab", async () => {
    const lookup = vi.fn().mockResolvedValue({ id: 3, title: "Rechnung" });
    await expect(findDuplicate(file, { lookup })).resolves.toEqual({ id: 3, title: "Rechnung" });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("fällt für ältere Paperless-Versionen auf MD5 zurück", async () => {
    const lookup = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 4, title: "Alt" });
    await expect(findDuplicate(file, { lookup })).resolves.toEqual({ id: 4, title: "Alt" });
    expect(lookup).toHaveBeenLastCalledWith("900150983cd24fb0d6963f7d28e17f72");
  });

  it("liefert null ohne Treffer", async () => {
    await expect(findDuplicate(file, { lookup: async () => null })).resolves.toBeNull();
  });

  it("blockiert den Upload nicht, wenn die Abfrage fehlschlägt", async () => {
    await expect(findDuplicate(file, { lookup: async () => Promise.reject(new Error("x")) })).resolves.toBeNull();
  });
});
