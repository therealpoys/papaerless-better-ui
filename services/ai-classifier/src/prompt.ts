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

Antworte ausschließlich mit einem JSON-Objekt (keine Erklärung, kein Markdown-Codeblock) mit exakt diesen Feldern:
{
  "title": string,               // ein prägnanter Titel, z.B. "Stromrechnung Mai 2026 - EnBW"
  "correspondent": string|null,  // Name, bevorzugt aus den bekannten Korrespondenten; sonst ein neuer, sinnvoller Name
  "documentType": string|null,   // Name, bevorzugt aus den bekannten Dokumenttypen
  "tags": string[],               // 0-4 passende Tags, bevorzugt aus den bekannten Tags
  "date": string|null,            // Dokumentdatum als YYYY-MM-DD, falls im Text erkennbar
  "amount": number|null,          // Rechnungs-/Vertragsbetrag in Euro, falls erkennbar
  "confidence": number            // 0.0-1.0, wie sicher du dir bei diesem Vorschlag insgesamt bist
}`;
}
