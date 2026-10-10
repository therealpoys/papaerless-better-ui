/** Rundet auf Cent. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Liest einen Betrag aus Zahl oder Text, z. B. "1.234,56 €", "EUR 1,234.56", "12,5", "-5.00".
 * Liefert `null`, wenn kein sinnvoller Betrag erkennbar ist.
 */
export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? toCents(input) : null;
  if (typeof input !== "string") return null;

  let s = input.replace(/[^\d.,\-−]/g, "").replace("−", "-");
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (!/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandsSep = decimalSep === "," ? "." : ",";
    normalized = s.split(thousandsSep).join("").replace(decimalSep, ".");
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? "," : ".";
    const parts = s.split(sep);
    const last = parts[parts.length - 1];
    if (parts.length > 2) {
      // mehrfach vorkommend = Tausendertrenner ("1.234.567")
      normalized = parts.join("");
    } else if (sep === "." && last.length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && parts[0] !== "0") {
      normalized = parts.join(""); // "1.234" = 1234
    } else {
      normalized = `${parts[0] || "0"}.${last}`;
    }
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return toCents(negative ? -n : n);
}

const pad = (n: number) => String(n).padStart(2, "0");

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Normalisiert ein Datum ("2026-05-01", "2026-05-01T10:00:00Z", "01.05.2026", "1.5.26") zu YYYY-MM-DD oder `null`. */
export function normalizeDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(s);
  if (iso) return validYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/.exec(s);
  if (de) {
    const year = de[3].length === 2 ? 2000 + Number(de[3]) : Number(de[3]);
    return validYmd(year, Number(de[2]), Number(de[1]));
  }
  return null;
}
