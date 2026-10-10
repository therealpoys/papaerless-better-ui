import type { ClassifyInput } from "./types.js";

const MAX_CONTENT_CHARS = 6000;

export function buildPrompt(input: ClassifyInput): string {
  const correspondentNames = input.knownCorrespondents.map((c) => c.name).join(", ") || "(keine)";
  const documentTypeNames = input.knownDocumentTypes.map((t) => t.name).join(", ") || "(keine)";
  const content = input.content.slice(0, MAX_CONTENT_CHARS);

  return `Du bist ein Assistent, der eingescannte Dokumente aus Paperless-ngx anhand ihres OCR-Texts kategorisiert.

Aktueller Titel: ${input.title || "(ohne Titel)"}

OCR-Text:
"""
${content}
"""

Beantworte diese fünf Fragen zum Dokument:

1. Tags: Was für Tags könnte man diesem Dokument geben? Nenne 1-4 kurze, allgemein verwendbare Stichwörter (z.B. "Versicherung", "Steuer"). Lass ein Feld nur leer ([]), wenn der Text dazu nichts hergibt.

2. Absender: Wer hat das Dokument ausgestellt? Der Absender steht fast immer ganz oben im Briefkopf oder in der Fußzeile (Firma, Behörde oder Person) und ist auch bei schlechtem OCR meist erkennbar. Bekannte Absender: ${correspondentNames}
   Wähle den passenden Absender exakt in der Schreibweise aus dieser Liste. Passt keiner, schlage einen neuen Namen vor (z.B. die Firma aus dem Briefkopf). Gib immer einen Absender an; null nur, wenn im Text wirklich kein Name vorkommt.

3. Art des Dokuments: Welche Art von Dokument ist das? Bekannte Dokumenttypen: ${documentTypeNames}
   Bevorzuge einen bekannten Typ, sonst eine neue kurze Bezeichnung (z.B. "Rechnung", "Vertrag").

4. Dokumentdatum: Das Datum, an dem das Dokument ausgestellt wurde (Rechnungs-/Briefdatum, nicht Fälligkeit oder Leistungszeitraum). Gib es als YYYY-MM-DD an; null, wenn keines erkennbar ist.

5. Betrag: Der Gesamtbetrag, der zu zahlen ist (Rechnungsbetrag brutto bzw. Zahlbetrag) in Euro als Zahl mit Punkt als Dezimaltrenner, z.B. 1234.56 für "1.234,56 €". Kein Betrag erkennbar oder kein Zahlungsdokument: null. Rate nie.

Antworte ausschließlich mit einem JSON-Objekt (keine Erklärung, kein Markdown-Codeblock) mit exakt diesen Feldern:
{
  "title": string,               // ein prägnanter Titel, z.B. "Stromrechnung Mai 2026 - EnBW"
  "tags": string[],              // Antwort auf Frage 1
  "correspondent": string|null,  // Antwort auf Frage 2: bekannter Absender oder neuer Vorschlag, möglichst nie null
  "documentType": string|null,   // Antwort auf Frage 3
  "date": string|null,           // Antwort auf Frage 4: Dokumentdatum als YYYY-MM-DD
  "amount": number|null,         // Antwort auf Frage 5: Gesamtbetrag in Euro
  "confidence": number           // 0.0-1.0, wie sicher du dir bei diesem Vorschlag insgesamt bist
}`;
}
