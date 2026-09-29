import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { classifyError, friendlyError } from "./errors";

const t = ((key: string) => `[${key}]`) as unknown as TFunction;

describe("classifyError", () => {
  it("erkennt fehlende Verbindung", () => {
    expect(classifyError(new TypeError("Failed to fetch"))).toBe("network");
  });
  it("ordnet HTTP-Status zu", () => {
    expect(classifyError(new Error("API-Fehler 401 bei /api/x: nope"))).toBe("auth");
    expect(classifyError(new Error("API-Fehler 403 bei /api/x: nope"))).toBe("auth");
    expect(classifyError(new Error("API-Fehler 404 bei /api/x: nope"))).toBe("notFound");
    expect(classifyError(new Error("API-Fehler 502 bei /api/x: nope"))).toBe("server");
    expect(classifyError(new Error("API-Fehler 422 bei /api/x: nope"))).toBe("unknown");
  });
  it("behandelt Unbekanntes", () => {
    expect(classifyError("boom")).toBe("unknown");
  });
});

describe("friendlyError", () => {
  it("zeigt nie die rohe Meldung", () => {
    const msg = friendlyError(new Error("API-Fehler 500 bei /api/documents/3: stack"), t, "Fehler.");
    expect(msg).toBe("Fehler. [errors.hint.server]");
    expect(msg).not.toContain("API-Fehler");
  });
});
