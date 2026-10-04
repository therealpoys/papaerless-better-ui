import type { ClassifyInput } from "./types.js";

const MAX_CONTENT_CHARS = 6000;

export function buildPrompt(input: ClassifyInput): string {
  const tagNames = input.knownTags.map((t) => t.name).join(", ") || "(keine)";
  const correspondentNames = input.knownCorrespondents.map((c) => c.name).join(", ") || "(keine)";
  const documentTypeNames = input.knownDocumentTypes.map((t) => t.name).join(", ") || "(keine)";
  const content = input.content.slice(0, MAX_CONTENT_CHARS);

  return `Du bist ein Assistent, der eingescannte Dokumente aus Paperless-ngx anhand ihres OCR-Texts kategorisiert.

Bekannte Tags: ${tagNames}
Bekannte Korrespondenten: ${correspondentNames}
Bekannte Dokumenttypen: ${documentTypeNames}

Aktueller Titel: ${input.title || "(ohne Titel)"}

OCR-Text:
"""
${content}
"""

Bekannte Einträge sind nur eine Hilfe, keine Beschränkung: Verwende sie exakt in der bekannten Schreibweise, wenn sie passen.
Passt keiner, schlage ausdrücklich einen neuen Eintrag vor, statt das Feld leer zu lassen. Der Absender steht fast immer im Briefkopf oder in der Fußzeile (Firma, Behörde, Person): nenne ihn, auch wenn er nicht bekannt ist.
Wähle einen bekannten Tag nur, wenn er inhaltlich wirklich zum Dokument passt, sonst lieber einen neuen. Lass ein Feld nur leer (null bzw. []), wenn der Text dazu nichts hergibt.

Antworte ausschließlich mit einem JSON-Objekt (keine Erklärung, kein Markdown-Codeblock) mit exakt diesen Feldern:
{
  "title": string,               // ein prägnanter Titel, z.B. "Stromrechnung Mai 2026 - EnBW"
  "correspondent": string|null,  // Absender/Aussteller, bevorzugt aus den bekannten Korrespondenten; passt keiner, ein neuer Name (z.B. Firmenname aus dem Briefkopf)
  "documentType": string|null,   // Art des Dokuments, bevorzugt aus den bekannten Dokumenttypen; passt keiner, eine neue kurze Bezeichnung (z.B. "Rechnung", "Vertrag")
  "tags": string[],               // 1-4 passende Tags, bevorzugt aus den bekannten Tags; passen sie nicht, neue kurze, allgemein verwendbare Tags
  "date": string|null,            // Dokumentdatum als YYYY-MM-DD, falls im Text erkennbar
  "amount": number|null,          // Rechnungs-/Vertragsbetrag in Euro, falls erkennbar
  "confidence": number            // 0.0-1.0, wie sicher du dir bei diesem Vorschlag insgesamt bist
}`;
}
