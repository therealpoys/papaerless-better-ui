import { describe, expect, it, vi } from "vitest";
import { fileFromShared, takeSharedFiles, type SharedFileInfo } from "./shareTarget";

const info = (over: Partial<SharedFileInfo> = {}): SharedFileInfo => ({
  path: "/cache/shared/1/rechnung.pdf",
  name: "rechnung.pdf",
  type: "application/pdf",
  ...over,
});

describe("fileFromShared", () => {
  it("lädt über die WebView-URL und übernimmt Name und Typ", async () => {
    const fetchFn = vi.fn(async () => new Response(new Blob(["x"])));
    const file = await fileFromShared(info(), (p) => `http://localhost/_file_${p}`, fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith("http://localhost/_file_/cache/shared/1/rechnung.pdf");
    expect(file.name).toBe("rechnung.pdf");
    expect(file.type).toBe("application/pdf");
  });

  it("fällt ohne Typ auf den Blob-Typ zurück", async () => {
    const fetchFn = vi.fn(async () => new Response(new Blob(["x"], { type: "image/png" })));
    const file = await fileFromShared(info({ type: "" }), (p) => p, fetchFn as unknown as typeof fetch);
    expect(file.type).toBe("image/png");
  });
});

describe("takeSharedFiles", () => {
  it("liefert die Dateien und meldet fehlgeschlagene als Fehler", async () => {
    const plugin = { getSharedFiles: async () => ({ files: [info(), info({ name: "kaputt.pdf" })] }) };
    const toFile = async (i: SharedFileInfo) => {
      if (i.name === "kaputt.pdf") throw new Error("weg");
      return new File(["x"], i.name, { type: i.type });
    };
    const { files, errors } = await takeSharedFiles(plugin, toFile);
    expect(files.map((f) => f.name)).toEqual(["rechnung.pdf"]);
    expect(errors).toEqual(["kaputt.pdf: weg"]);
  });

  it("reicht Fehler des nativen Teils durch", async () => {
    const plugin = { getSharedFiles: async () => ({ files: [], errors: ["IOException: x"] }) };
    expect((await takeSharedFiles(plugin)).errors).toEqual(["IOException: x"]);
  });

  it("liefert nichts, wenn nichts geteilt wurde", async () => {
    expect(await takeSharedFiles({ getSharedFiles: async () => ({ files: [] }) })).toEqual({ files: [], errors: [] });
  });
});
