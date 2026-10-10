import { describe, expect, it } from "vitest";
import { clampZoom, MAX_ZOOM, MIN_ZOOM, previewKind, stepZoom } from "./preview";

describe("previewKind", () => {
  it("erkennt PDF, Bilder und anderes", () => {
    expect(previewKind("application/pdf")).toBe("pdf");
    expect(previewKind("Application/PDF; charset=binary")).toBe("pdf");
    expect(previewKind("image/webp")).toBe("image");
    expect(previewKind("text/plain")).toBe("other");
    expect(previewKind(null)).toBe("other");
  });
});

describe("Zoom", () => {
  it("begrenzt den Faktor", () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(NaN)).toBe(MIN_ZOOM);
    expect(clampZoom(2)).toBe(2);
  });
  it("zoomt schrittweise und stoppt an den Grenzen", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
  });
});
