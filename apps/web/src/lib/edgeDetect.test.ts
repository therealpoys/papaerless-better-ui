import { describe, expect, it } from "vitest";
import {
  applyHomography,
  blur,
  computeHomography,
  detectDocumentCorners,
  downscale,
  isAxisAligned,
  orderCorners,
  otsuThreshold,
  polygonArea,
  quadBounds,
  warpOutputSize,
  warpPerspective,
  type PixelImage,
  type Point,
  type Quad,
} from "./edgeDetect";

function makeImage(w: number, h: number, bg: number): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([bg, bg, bg, 255], i * 4);
  return { width: w, height: h, data };
}

function pointInPoly(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function fillPoly(img: PixelImage, poly: Point[], value: number) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (pointInPoly({ x: x + 0.5, y: y + 0.5 }, poly)) img.data.set([value, value, value, 255], (y * img.width + x) * 4);
    }
  }
}

function rotatedRect(cx: number, cy: number, w: number, h: number, deg: number): Quad {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c })) as Quad;
}

/** Deterministisches Rauschen (LCG), damit die Tests stabil bleiben. */
function addNoise(img: PixelImage, amplitude: number, seed = 42) {
  let state = seed;
  const rnd = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296) - 0.5;
  for (let i = 0; i < img.width * img.height; i++) {
    const n = rnd() * 2 * amplitude;
    for (let c = 0; c < 3; c++) img.data[i * 4 + c] = Math.min(255, Math.max(0, img.data[i * 4 + c] + n));
  }
}

function expectCorners(found: Quad | null, expected: Quad, tol: number) {
  expect(found).not.toBeNull();
  const ordered = orderCorners(expected);
  found!.forEach((p, i) => {
    expect(Math.hypot(p.x - ordered[i].x, p.y - ordered[i].y)).toBeLessThanOrEqual(tol);
  });
}

describe("Grundbausteine", () => {
  it("downscale verkleinert und vergrößert nie", () => {
    const img = makeImage(400, 200, 100);
    const small = downscale(img, 100);
    expect(small.width).toBe(100);
    expect(small.height).toBe(50);
    expect(small.data[0]).toBe(100);
    expect(downscale(img, 1000)).toBe(img);
  });

  it("otsuThreshold trennt zwei Helligkeitsgruppen", () => {
    const g = new Float32Array(100);
    g.fill(30, 0, 50);
    g.fill(220, 50);
    const t = otsuThreshold(g);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(220);
  });

  it("blur lässt ein einfarbiges Bild unverändert", () => {
    const g = new Float32Array(25).fill(80);
    expect(Array.from(blur(g, 5, 5)).every((v) => Math.abs(v - 80) < 1e-4)).toBe(true);
  });

  it("orderCorners ordnet oben links, oben rechts, unten rechts, unten links", () => {
    const q = orderCorners([
      { x: 90, y: 90 },
      { x: 10, y: 12 },
      { x: 10, y: 88 },
      { x: 92, y: 8 },
    ]);
    expect(q.map((p) => [p.x, p.y])).toEqual([
      [10, 12],
      [92, 8],
      [90, 90],
      [10, 88],
    ]);
  });

  it("polygonArea und quadBounds", () => {
    const q: Quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ];
    expect(polygonArea(q)).toBe(50);
    expect(quadBounds(q)).toEqual({ x: 0, y: 0, w: 10, h: 5 });
    expect(isAxisAligned(q, 0.5)).toBe(true);
    expect(isAxisAligned(rotatedRect(50, 50, 40, 30, 10), 1)).toBe(false);
  });
});

describe("detectDocumentCorners", () => {
  it("findet ein helles Rechteck auf dunklem Grund", () => {
    const img = makeImage(400, 300, 30);
    const doc = rotatedRect(200, 150, 240, 180, 0);
    fillPoly(img, doc, 225);
    expectCorners(detectDocumentCorners(img), doc, 6);
  });

  it("findet ein gedrehtes Dokument (15 und -25 Grad)", () => {
    for (const deg of [15, -25]) {
      const img = makeImage(400, 300, 40);
      const doc = rotatedRect(200, 150, 220, 160, deg);
      fillPoly(img, doc, 230);
      expectCorners(detectDocumentCorners(img), doc, 7);
    }
  });

  it("findet ein um 45 Grad gedrehtes Dokument", () => {
    const img = makeImage(400, 400, 20);
    const doc = rotatedRect(200, 200, 200, 200, 45);
    fillPoly(img, doc, 240);
    expectCorners(detectDocumentCorners(img), doc, 8);
  });

  it("findet ein perspektivisch verzerrtes Viereck", () => {
    const img = makeImage(400, 300, 35);
    const doc: Quad = [
      { x: 90, y: 40 },
      { x: 320, y: 70 },
      { x: 350, y: 260 },
      { x: 60, y: 240 },
    ];
    fillPoly(img, doc, 220);
    expectCorners(detectDocumentCorners(img), doc, 8);
  });

  it("kommt mit Rauschen und Text auf dem Papier zurecht", () => {
    const img = makeImage(400, 300, 50);
    const doc = rotatedRect(200, 150, 240, 190, 8);
    fillPoly(img, doc, 215);
    // dunkle "Textzeilen"
    for (let i = 0; i < 8; i++) fillPoly(img, rotatedRect(200, 90 + i * 16, 180, 5, 8), 60);
    addNoise(img, 40);
    expectCorners(detectDocumentCorners(img), doc, 9);
  });

  it("liefert Koordinaten im Originalmaßstab bei großen Bildern", () => {
    const img = makeImage(1200, 900, 30);
    const doc = rotatedRect(600, 450, 700, 500, 5);
    fillPoly(img, doc, 230);
    expectCorners(detectDocumentCorners(img), doc, 15);
  });

  it("erkennt auch ein dunkles Dokument auf hellem Grund", () => {
    const img = makeImage(400, 300, 235);
    const doc = rotatedRect(200, 150, 200, 150, 0);
    fillPoly(img, doc, 40);
    expectCorners(detectDocumentCorners(img), doc, 6);
  });

  it("gibt null zurück, wenn kein Dokument zu sehen ist", () => {
    const flat = makeImage(300, 200, 120);
    expect(detectDocumentCorners(flat)).toBeNull();
    const noisy = makeImage(300, 200, 120);
    addNoise(noisy, 60, 7);
    expect(detectDocumentCorners(noisy)).toBeNull();
  });

  it("gibt null zurück, wenn das Papier das ganze Bild füllt oder winzig ist", () => {
    const full = makeImage(300, 200, 40);
    fillPoly(full, rotatedRect(150, 100, 300, 200, 0), 230);
    expect(detectDocumentCorners(full)).toBeNull();
    const tiny = makeImage(300, 200, 40);
    fillPoly(tiny, rotatedRect(150, 100, 30, 20, 0), 230);
    expect(detectDocumentCorners(tiny)).toBeNull();
  });

  it("gibt null zurück bei zu kleinen Bildern", () => {
    expect(detectDocumentCorners(makeImage(4, 4, 0))).toBeNull();
  });
});

describe("Homographie und Perspektivkorrektur", () => {
  const rect: Quad = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 },
  ];
  const skew: Quad = [
    { x: 10, y: 5 },
    { x: 120, y: 20 },
    { x: 110, y: 80 },
    { x: 0, y: 60 },
  ];

  it("bildet die vier Eckpunkte exakt ab", () => {
    const h = computeHomography(rect, skew)!;
    rect.forEach((p, i) => {
      const r = applyHomography(h, p);
      expect(r.x).toBeCloseTo(skew[i].x, 6);
      expect(r.y).toBeCloseTo(skew[i].y, 6);
    });
  });

  it("liefert null bei entarteten (kollinearen) Punkten", () => {
    const line: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(computeHomography(line, rect)).toBeNull();
  });

  it("warpOutputSize nimmt mittlere Kantenlängen und begrenzt die Größe", () => {
    expect(warpOutputSize(rect)).toEqual({ w: 100, h: 50 });
    const big = rect.map((p) => ({ x: p.x * 100, y: p.y * 100 })) as Quad;
    const s = warpOutputSize(big, 1000);
    expect(Math.max(s.w, s.h)).toBe(1000);
  });

  it("entzerrt ein gedrehtes Dokument auf ein Rechteck mit passenden Farben", () => {
    const img = makeImage(400, 300, 30);
    const doc = rotatedRect(200, 150, 240, 160, 20);
    fillPoly(img, doc, 220);
    // rote Markierung nahe der oberen linken Dokumentecke
    const marker = [doc[0], doc[1], doc[2], doc[3]].map((c, i) => ({
      x: c.x + (doc[(i + 2) % 4].x - c.x) * 0.08,
      y: c.y + (doc[(i + 2) % 4].y - c.y) * 0.08,
    }));
    void marker;
    const corners = detectDocumentCorners(img)!;
    const out = warpPerspective(img, corners)!;
    expect(Math.abs(out.width - 240)).toBeLessThanOrEqual(6);
    expect(Math.abs(out.height - 160)).toBeLessThanOrEqual(6);
    // Innenbereich weitgehend Papier, kein dunkler Hintergrund an den Rändern
    let dark = 0;
    for (let i = 0; i < out.width * out.height; i++) if (out.data[i * 4] < 120) dark++;
    expect(dark / (out.width * out.height)).toBeLessThan(0.03);
  });

  it("korrigiert die Perspektive: ein Muster landet an den richtigen Stellen", () => {
    const img = makeImage(400, 300, 30);
    const doc: Quad = [
      { x: 90, y: 40 },
      { x: 320, y: 70 },
      { x: 350, y: 260 },
      { x: 60, y: 240 },
    ];
    fillPoly(img, doc, 230);
    // schwarzer Punkt nahe oben links im Dokument (bilinear zwischen den Ecken, 10 %/10 %)
    const h = computeHomography(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      doc,
    )!;
    const spot = applyHomography(h, { x: 0.1, y: 0.1 });
    fillPoly(
      img,
      [
        { x: spot.x - 4, y: spot.y - 4 },
        { x: spot.x + 4, y: spot.y - 4 },
        { x: spot.x + 4, y: spot.y + 4 },
        { x: spot.x - 4, y: spot.y + 4 },
      ],
      0,
    );
    const out = warpPerspective(img, doc, { w: 200, h: 100 })!;
    const at = (x: number, y: number) => out.data[(y * out.width + x) * 4];
    expect(at(20, 10)).toBeLessThan(60);
    expect(at(100, 50)).toBeGreaterThan(200);
    expect(at(180, 90)).toBeGreaterThan(200);
  });

  it("warpPerspective gibt null bei entartetem Viereck zurück", () => {
    const img = makeImage(20, 20, 0);
    const same: Quad = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(warpPerspective(img, same, { w: 10, h: 10 })).toBeNull();
  });
});
