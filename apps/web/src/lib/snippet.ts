/** Reine Logik für Trefferausschnitte in der Dokumentliste (kein React, kein HTML). */

export interface SnippetSegment {
  text: string;
  /** true = Suchbegriff, wird als <mark> dargestellt. */
  match: boolean;
}

export interface Snippet {
  segments: SnippetSegment[];
  /** Ausschnitt beginnt nicht am Textanfang. */
  truncatedStart: boolean;
  /** Ausschnitt endet nicht am Textende. */
  truncatedEnd: boolean;
}

export const DEFAULT_CONTEXT = 100;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Zerlegt eine Suche in einzelne Begriffe (Whitespace, Anführungszeichen entfernt, ohne Duplikate). */
export function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of query.split(/\s+/)) {
    const term = raw.replace(/["„“”']/g, "").trim();
    if (!term) continue;
    const key = term.toLocaleLowerCase("de");
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  return terms;
}

function termRegex(terms: string[]): RegExp {
  // Längere Begriffe zuerst, damit "Strom" nicht "Stromrechnung" in zwei Teile zerlegt.
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  return new RegExp(sorted.map(escapeRegExp).join("|"), "giu");
}

/** Teilt Text in Treffer/Nicht-Treffer-Segmente. Ohne Begriffe: ein einziges Segment. */
export function highlightSegments(text: string, query: string): SnippetSegment[] {
  const terms = queryTerms(query);
  if (!text) return [];
  if (terms.length === 0) return [{ text, match: false }];
  const re = termRegex(terms);
  const segments: SnippetSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m[0].length === 0) continue;
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ text: text.slice(last, idx), match: false });
    segments.push({ text: m[0], match: true });
    last = idx + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments;
}

/**
 * Liefert eine Textstelle um den ersten Treffer (ca. `context` Zeichen davor und danach),
 * an Wortgrenzen beschnitten. null, wenn kein Begriff im Inhalt vorkommt.
 */
export function buildSnippet(
  content: string | null | undefined,
  query: string | null | undefined,
  context = DEFAULT_CONTEXT,
): Snippet | null {
  if (!content || !query) return null;
  const terms = queryTerms(query);
  if (terms.length === 0) return null;

  // OCR-Text enthält viele Zeilenumbrüche/Mehrfachleerzeichen.
  const text = content.replace(/\s+/g, " ").trim();
  const first = termRegex(terms).exec(text);
  if (!first || first[0].length === 0) return null;

  let start = Math.max(0, first.index - context);
  let end = Math.min(text.length, first.index + first[0].length + context);

  // Nicht mitten im Wort anfangen/aufhören (aber den Treffer selbst nie abschneiden).
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < first.index) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > first.index + first[0].length) end = space;
  }

  const slice = text.slice(start, end);
  return {
    segments: highlightSegments(slice, query),
    truncatedStart: start > 0,
    truncatedEnd: end < text.length,
  };
}
