import { describe, expect, it } from "vitest";
import { adjustRect, CROP_OUTPUT, croppedFileName, isCroppable, isFullRect, toSourceRect } from "./crop";

const bounds = { w: 400, h: 300 };
const full = { x: 0, y: 0, w: 400, h: 300 };

describe("adjustRect", () => {
  it("verschiebt den Rahmen, aber nicht aus dem Bild", () => {
    const r = { x: 100, y: 100, w: 100, h: 100 };
    expect(adjustRect(r, "move", 50, -20, bounds)).toEqual({ x: 150, y: 80, w: 100, h: 100 });
    expect(adjustRect(r, "move", 999, 999, bounds)).toEqual({ x: 300, y: 200, w: 100, h: 100 });
    expect(adjustRect(r, "move", -999, -999, bounds)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it("zieht an einer Ecke", () => {
    expect(adjustRect(full, "nw", 100, 50, bounds)).toEqual({ x: 100, y: 50, w: 300, h: 250 });
    expect(adjustRect(full, "se", -100, -50, bounds)).toEqual({ x: 0, y: 0, w: 300, h: 250 });
  });

  it("zieht an einer Kante", () => {
    expect(adjustRect(full, "e", -200, 999, bounds)).toEqual({ x: 0, y: 0, w: 200, h: 300 });
    expect(adjustRect(full, "n", 999, 100, bounds)).toEqual({ x: 0, y: 100, w: 400, h: 200 });
  });

  it("unterschreitet die Mindestgröße nicht und verlässt das Bild nicht", () => {
    expect(adjustRect(full, "e", -999, 0, bounds, 40).w).toBe(40);
    expect(adjustRect(full, "w", 999, 0, bounds, 40)).toMatchObject({ x: 360, w: 40 });
    expect(adjustRect(full, "se", 999, 999, bounds)).toEqual(full);
    expect(adjustRect(full, "nw", -999, -999, bounds)).toEqual(full);
  });
});

describe("toSourceRect", () => {
  it("rechnet in Originalpixel um", () => {
    const r = toSourceRect({ x: 100, y: 50, w: 200, h: 100 }, bounds, { w: 4000, h: 3000 });
    expect(r).toEqual({ x: 1000, y: 500, w: 2000, h: 1000 });
  });

  it("bleibt innerhalb des Bildes", () => {
    const r = toSourceRect({ x: 399.9, y: 299.9, w: 50, h: 50 }, bounds, { w: 800, h: 600 });
    expect(r.x + r.w).toBeLessThanOrEqual(800);
    expect(r.y + r.h).toBeLessThanOrEqual(600);
    expect(r.w).toBeGreaterThanOrEqual(1);
  });
});

describe("isFullRect", () => {
  it("erkennt das ganze Bild", () => {
    expect(isFullRect(full, bounds)).toBe(true);
    expect(isFullRect({ x: 0.5, y: 0, w: 399.5, h: 300 }, bounds)).toBe(true);
    expect(isFullRect({ x: 10, y: 0, w: 390, h: 300 }, bounds)).toBe(false);
  });
});

describe("CROP_OUTPUT / croppedFileName / isCroppable", () => {
  it("speichert immer als JPEG", () => {
    expect(CROP_OUTPUT).toEqual({ type: "image/jpeg", extension: "jpg" });
  });

  it("benennt den Zuschnitt", () => {
    expect(croppedFileName("rechnung.heic", "jpg")).toBe("rechnung-zugeschnitten.jpg");
    expect(croppedFileName("a.b.png", "png")).toBe("a.b-zugeschnitten.png");
    expect(croppedFileName("", "jpg")).toBe("foto-zugeschnitten.jpg");
  });

  it("schneidet nur Bilder zu", () => {
    expect(isCroppable({ name: "x.pdf", type: "application/pdf" })).toBe(false);
    expect(isCroppable({ name: "x.eml", type: "" })).toBe(false);
    expect(isCroppable({ name: "x.jpg", type: "image/jpeg" })).toBe(true);
    expect(isCroppable({ name: "IMG.HEIC", type: "" })).toBe(true);
  });
});
