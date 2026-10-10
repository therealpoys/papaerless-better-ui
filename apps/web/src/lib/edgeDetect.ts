/**
 * Automatische Dokumenterkennung ohne Abhängigkeiten (reine Funktionen auf Pixeldaten).
 *
 * Ablauf: verkleinern → Graustufen → Weichzeichnen → Otsu-Schwellwert → größte zusammenhängende
 * Region (Papier) → vier Eckpunkte → Plausibilitätsprüfung. Dazu eine Perspektivkorrektur
 * (Homographie), die das gefundene Viereck auf ein Rechteck entzerrt.
 */

export interface Point {
  x: number;
  y: number;
}

/** Ecken in der Reihenfolge oben links, oben rechts, unten rechts, unten links. */
export type Quad = [Point, Point, Point, Point];

/** Kompatibel zu ImageData (damit Tests ohne DOM auskommen). */
export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface DetectOptions {
  /** Längste Kante des Arbeitsbilds */
  maxSize?: number;
  /** Mindestanteil der Bildfläche, den das Dokument einnehmen muss */
  minAreaRatio?: number;
  /** Maximalanteil; darüber ist es vermutlich der Hintergrund / ein Vollbild */
  maxAreaRatio?: number;
  /** Mindestanteil, den die Region vom gefundenen Viereck ausfüllen muss */
  minFillRatio?: number;
}

/** Verkleinert per Mittelwert (Boxfilter); vergrößert nie. */
export function downscale(img: PixelImage, maxSize: number): PixelImage {
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  if (scale >= 1) return img;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 4;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
          n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

export function toGray(img: PixelImage): Float32Array {
  const g = new Float32Array(img.width * img.height);
  for (let i = 0; i < g.length; i++) {
    g[i] = 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
  }
  return g;
}

/** Separabler 5er-Binomialfilter (Näherung eines Gauß-Filters), Ränder werden fortgesetzt. */
export function blur(gray: Float32Array, w: number, h: number): Float32Array {
  const k = [1, 4, 6, 4, 1];
  const clamp = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);
  const tmp = new Float32Array(gray.length);
  const out = new Float32Array(gray.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) s += k[i + 2] * gray[y * w + clamp(x + i, w - 1)];
      tmp[y * w + x] = s / 16;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) s += k[i + 2] * tmp[clamp(y + i, h - 1) * w + x];
      out[y * w + x] = s / 16;
    }
  }
  return out;
}

/** Otsu-Schwellwert (0–255) für ein Graustufenbild. */
export function otsuThreshold(gray: Float32Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[Math.min(255, Math.max(0, Math.round(v)))]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Größte 4er-zusammenhängende Region der Maske; liefert die Pixelindizes. */
export function largestComponent(mask: Uint8Array, w: number, h: number): number[] {
  const seen = new Uint8Array(mask.length);
  let best: number[] = [];
  const stack: number[] = [];
  const push = (q: number) => {
    if (mask[q] && !seen[q]) {
      seen[q] = 1;
      stack.push(q);
    }
  };
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const comp: number[] = [];
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      comp.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }
    if (comp.length > best.length) best = comp;
  }
  return best;
}

export function polygonArea(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Sortiert vier Punkte im Uhrzeigersinn (y nach unten), beginnend oben links. */
export function orderCorners(pts: Point[]): Quad {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const sorted = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let first = 0;
  for (let i = 1; i < 4; i++) {
    if (sorted[i].x + sorted[i].y < sorted[first].x + sorted[first].y) first = i;
  }
  return [0, 1, 2, 3].map((i) => sorted[(first + i) % 4]) as Quad;
}

/**
 * Findet die vier Eckpunkte einer Pixelmenge: Für gedrehte Richtungspaare werden die jeweils
 * äußersten Punkte gesucht; gewählt wird die Drehung mit dem größten Viereck.
 */
export function cornersOfPixels(pixels: number[], w: number): Quad | null {
  if (pixels.length < 4) return null;
  let bestArea = -1;
  let bestPts: Point[] | null = null;
  for (let deg = 0; deg < 90; deg += 3) {
    const a = (deg * Math.PI) / 180;
    const dirs = [0, 1, 2, 3].map((k) => {
      const t = a + Math.PI / 4 + (k * Math.PI) / 2;
      return { dx: Math.cos(t), dy: Math.sin(t), best: -Infinity, p: { x: 0, y: 0 } };
    });
    for (const idx of pixels) {
      const x = idx % w;
      const y = (idx - x) / w;
      for (const d of dirs) {
        const v = x * d.dx + y * d.dy;
        if (v > d.best) {
          d.best = v;
          d.p = { x, y };
        }
      }
    }
    const pts = dirs.map((d) => d.p);
    const area = polygonArea(orderCorners(pts));
    if (area > bestArea) {
      bestArea = area;
      bestPts = pts;
    }
  }
  return bestPts ? orderCorners(bestPts) : null;
}

const DEFAULTS: Required<DetectOptions> = {
  maxSize: 320,
  minAreaRatio: 0.12,
  maxAreaRatio: 0.97,
  minFillRatio: 0.8,
};

function candidate(
  gray: Float32Array,
  w: number,
  h: number,
  threshold: number,
  bright: boolean,
  opts: Required<DetectOptions>,
): { quad: Quad; score: number } | null {
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) mask[i] = (gray[i] > threshold) === bright ? 1 : 0;
  const comp = largestComponent(mask, w, h);
  const ratio = comp.length / (w * h);
  if (ratio < opts.minAreaRatio || ratio > opts.maxAreaRatio) return null;
  const quad = cornersOfPixels(comp, w);
  if (!quad) return null;
  const quadArea = polygonArea(quad);
  if (quadArea <= 0) return null;
  const fill = comp.length / quadArea;
  if (fill < opts.minFillRatio) return null;
  // Eine Region, die an drei oder mehr Bildrändern klebt, ist meist der Hintergrund.
  const sides = [false, false, false, false];
  for (const p of comp) {
    const x = p % w;
    const y = (p - x) / w;
    if (x === 0) sides[0] = true;
    if (x === w - 1) sides[1] = true;
    if (y === 0) sides[2] = true;
    if (y === h - 1) sides[3] = true;
  }
  if (sides.filter(Boolean).length >= 3) return null;
  return { quad, score: Math.min(fill, 1) * Math.sqrt(ratio) };
}

/**
 * Sucht die vier Dokumentecken. Rückgabe in Pixeln des übergebenen Bilds
 * (oben links, oben rechts, unten rechts, unten links) oder null, wenn nichts Plausibles gefunden wurde.
 */
export function detectDocumentCorners(img: PixelImage, options: DetectOptions = {}): Quad | null {
  const opts = { ...DEFAULTS, ...options };
  if (img.width < 8 || img.height < 8) return null;
  const small = downscale(img, opts.maxSize);
  const gray = blur(toGray(small), small.width, small.height);
  const threshold = otsuThreshold(gray);
  const found = [true, false]
    .map((bright) => candidate(gray, small.width, small.height, threshold, bright, opts))
    .filter((c): c is { quad: Quad; score: number } => c !== null)
    .sort((a, b) => b.score - a.score)[0];
  if (!found) return null;
  const sx = img.width / small.width;
  const sy = img.height / small.height;
  return found.quad.map((p) => ({
    x: Math.min(img.width - 1, Math.max(0, (p.x + 0.5) * sx)),
    y: Math.min(img.height - 1, Math.max(0, (p.y + 0.5) * sy)),
  })) as Quad;
}

/** Kleinster achsenparalleler Rahmen um das Viereck. */
export function quadBounds(q: Quad): { x: number; y: number; w: number; h: number } {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Skaliert alle Ecken (z. B. von Bild- in Anzeigepixel). */
export function scaleQuad(q: Quad, fx: number, fy: number): Quad {
  return q.map((p) => ({ x: p.x * fx, y: p.y * fy })) as Quad;
}

/** true, wenn das Viereck (nahezu) achsenparallel ist – dann genügt ein einfacher Zuschnitt. */
export function isAxisAligned(q: Quad, tolerance: number): boolean {
  return (
    Math.abs(q[0].y - q[1].y) <= tolerance &&
    Math.abs(q[3].y - q[2].y) <= tolerance &&
    Math.abs(q[0].x - q[3].x) <= tolerance &&
    Math.abs(q[1].x - q[2].x) <= tolerance
  );
}

/** Löst die 8 Homographie-Parameter (h33 = 1), die src[i] auf dst[i] abbilden. Null bei entarteten Punkten. */
export function computeHomography(src: Quad, dst: Quad): number[] | null {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-10) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[8] / row[i]);
}

export function applyHomography(h: number[], p: Point): Point {
  const d = h[6] * p.x + h[7] * p.y + 1;
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / d, y: (h[3] * p.x + h[4] * p.y + h[5]) / d };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Zielgröße der Entzerrung aus den mittleren Kantenlängen, begrenzt auf maxSide. */
export function warpOutputSize(q: Quad, maxSide = 3000): { w: number; h: number } {
  let w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  let h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  const s = Math.min(1, maxSide / Math.max(w, h));
  w *= s;
  h *= s;
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

/** Entzerrt das Viereck auf ein Rechteck (bilinear). Null, wenn die Ecken entartet sind. */
export function warpPerspective(img: PixelImage, quad: Quad, size = warpOutputSize(quad)): PixelImage | null {
  const { w, h } = size;
  const dst: Quad = [
    { x: 0, y: 0 },
    { x: w - 1, y: 0 },
    { x: w - 1, y: h - 1 },
    { x: 0, y: h - 1 },
  ];
  const hm = computeHomography(dst, quad); // Rückwärtsabbildung: Ziel → Quelle
  if (!hm) return null;
  const out = new Uint8ClampedArray(w * h * 4);
  const px = (xx: number, yy: number, c: number) =>
    img.data[(Math.min(img.height - 1, Math.max(0, yy)) * img.width + Math.min(img.width - 1, Math.max(0, xx))) * 4 + c];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = applyHomography(hm, { x, y });
      const x0 = Math.floor(s.x);
      const y0 = Math.floor(s.y);
      const fx = s.x - x0;
      const fy = s.y - y0;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        out[o + c] =
          px(x0, y0, c) * (1 - fx) * (1 - fy) +
          px(x0 + 1, y0, c) * fx * (1 - fy) +
          px(x0, y0 + 1, c) * (1 - fx) * fy +
          px(x0 + 1, y0 + 1, c) * fx * fy;
      }
    }
  }
  return { width: w, height: h, data: out };
}
