import { describe, expect, it, vi } from "vitest";
import { detectNative } from "./platform";
import {
  getStoredServerUrl,
  needsServerSetup,
  normalizeServerUrl,
  resolveApiBase,
  saveServerUrl,
  testConnection,
} from "./serverUrl";
import { resolveBackAction } from "./backNavigation";
import { fileFromPhotoPath, photoFileName } from "./photo";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
    data,
  };
}

describe("detectNative", () => {
  it("erkennt native Plattform nur bei true", () => {
    expect(detectNative({ isNativePlatform: () => true })).toBe(true);
    expect(detectNative({ isNativePlatform: () => false })).toBe(false);
    expect(detectNative(undefined)).toBe(false);
    expect(detectNative({})).toBe(false);
    expect(detectNative({ isNativePlatform: () => { throw new Error("x"); } })).toBe(false);
  });
});

describe("normalizeServerUrl", () => {
  it("entfernt Leerraum und Slashes am Ende", () => {
    expect(normalizeServerUrl("  https://a.de/// ")).toEqual({ ok: true, url: "https://a.de" });
  });
  it("ergänzt https, wenn das Schema fehlt", () => {
    expect(normalizeServerUrl("a.de:3001")).toEqual({ ok: true, url: "https://a.de:3001" });
  });
  it("behält http und Unterpfad, verwirft Query und Hash", () => {
    expect(normalizeServerUrl("http://192.168.1.5:3001/paperless/?x=1#y")).toEqual({
      ok: true,
      url: "http://192.168.1.5:3001/paperless",
    });
  });
  it("lehnt leere, fremde und kaputte Eingaben ab", () => {
    expect(normalizeServerUrl("   ")).toEqual({ ok: false, error: "empty" });
    expect(normalizeServerUrl("ftp://a.de")).toEqual({ ok: false, error: "invalid" });
    expect(normalizeServerUrl("https://")).toEqual({ ok: false, error: "invalid" });
    expect(normalizeServerUrl("https://user:pw@a.de")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("Server-URL speichern", () => {
  it("speichert normalisiert und liest wieder aus", () => {
    const s = memoryStorage();
    expect(saveServerUrl("a.de/", s)).toEqual({ ok: true, url: "https://a.de" });
    expect(getStoredServerUrl(s)).toBe("https://a.de");
  });
  it("speichert nichts bei ungültiger Eingabe", () => {
    const s = memoryStorage();
    expect(saveServerUrl("", s).ok).toBe(false);
    expect(getStoredServerUrl(s)).toBeNull();
  });
  it("ignoriert kaputte gespeicherte Werte und Storage-Fehler", () => {
    expect(getStoredServerUrl(memoryStorage({ "papaerless.serverUrl": "ftp://x" }))).toBeNull();
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => {} };
    expect(getStoredServerUrl(broken)).toBeNull();
    expect(saveServerUrl("a.de", broken).ok).toBe(false);
  });
});

describe("resolveApiBase / needsServerSetup", () => {
  it("Browser bleibt unverändert", () => {
    expect(resolveApiBase(false, "https://x.de", undefined)).toBe("http://localhost:3001");
    expect(resolveApiBase(false, null, "https://env.de")).toBe("https://env.de");
  });
  it("native App nutzt nur die gespeicherte URL", () => {
    expect(resolveApiBase(true, "https://x.de", "https://env.de")).toBe("https://x.de");
    expect(resolveApiBase(true, null, "https://env.de")).toBe("");
  });
  it("Einrichtung nur nativ und ohne URL", () => {
    expect(needsServerSetup(true, null)).toBe(true);
    expect(needsServerSetup(true, "https://x.de")).toBe(false);
    expect(needsServerSetup(false, null)).toBe(false);
  });
});

describe("testConnection", () => {
  const res = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;
  it("ok, wenn /health und geschützter Endpunkt antworten", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(200)).mockResolvedValueOnce(res(200));
    await expect(testConnection("https://a.de", f as never, { Authorization: "Bearer t" })).resolves.toBe("ok");
    expect(f).toHaveBeenNthCalledWith(1, "https://a.de/health");
    expect(f).toHaveBeenNthCalledWith(2, "https://a.de/api/ai/status", { headers: { Authorization: "Bearer t" } });
  });
  it("unauthorized bei 401", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(200)).mockResolvedValueOnce(res(401));
    await expect(testConnection("https://a.de", f as never)).resolves.toBe("unauthorized");
  });
  it("notServer, wenn /health fehlt", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(404));
    await expect(testConnection("https://a.de", f as never)).resolves.toBe("notServer");
  });
  it("unreachable bei Netzwerkfehler", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(testConnection("https://a.de", f as never)).resolves.toBe("unreachable");
  });
});

describe("resolveBackAction", () => {
  it("schließt zuerst das Dokument-Detail", () => {
    expect(
      resolveBackAction({ tab: "documents", documentId: 5, filters: { query: "a" }, page: 2 }),
    ).toEqual({ type: "navigate", route: { tab: "documents", documentId: null, filters: { query: "a" }, page: 2 } });
  });
  it("geht in Ordnern Dokument, dann Ordner, dann Startseite", () => {
    expect(resolveBackAction({ tab: "folders", folderId: "f", documentId: 3 })).toEqual({
      type: "navigate",
      route: { tab: "folders", folderId: "f", documentId: null },
    });
    expect(resolveBackAction({ tab: "folders", folderId: "f", documentId: null })).toEqual({
      type: "navigate",
      route: { tab: "folders", folderId: null, documentId: null },
    });
    expect(resolveBackAction({ tab: "folders", folderId: null, documentId: null })).toEqual({
      type: "navigate",
      route: { tab: "home" },
    });
  });
  it("andere Reiter gehen zur Startseite, dort wird beendet", () => {
    expect(resolveBackAction({ tab: "settings" })).toEqual({ type: "navigate", route: { tab: "home" } });
    expect(resolveBackAction({ tab: "documents", documentId: null, filters: {}, page: 1 })).toEqual({
      type: "navigate",
      route: { tab: "home" },
    });
    expect(resolveBackAction({ tab: "home" })).toEqual({ type: "exit" });
  });
});

describe("Foto aus der Kamera", () => {
  it("baut einen sortierbaren Dateinamen", () => {
    expect(photoFileName(new Date(2026, 9, 6, 4, 3, 2))).toBe("foto-2026-10-06-04-03-02.jpg");
  });
  it("macht aus dem Foto eine File mit Typ", async () => {
    const f = vi.fn().mockResolvedValue({ blob: async () => new Blob(["x"], { type: "image/jpeg" }) });
    const file = await fileFromPhotoPath("https://localhost/_capacitor_file_/a", "jpeg", new Date(2026, 0, 2, 3, 4, 5), f as never);
    expect(file.name).toBe("foto-2026-01-02-03-04-05.jpg");
    expect(file.type).toBe("image/jpeg");
  });
});
