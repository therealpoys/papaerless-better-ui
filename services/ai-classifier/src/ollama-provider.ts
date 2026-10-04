import type { MetadataSuggestion } from "@papaerless/shared-types";
import { parseSuggestion } from "./parse.js";
import { buildPrompt } from "./prompt.js";
import type { Classifier, ClassifyInput } from "./types.js";

// Auf CPU-only-Servern braucht ein kleines Modell pro Dokument schnell 30–90 s.
const REQUEST_TIMEOUT_MS = 5 * 60_000;
// Ollamas Default (4096) würde Prompt + 6000 Zeichen OCR-Text abschneiden.
const NUM_CTX = 8192;

export class OllamaClassifier implements Classifier {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly model: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async classify(input: ClassifyInput): Promise<MetadataSuggestion> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: "json",
        options: { temperature: 0, num_ctx: NUM_CTX },
        messages: [{ role: "user", content: buildPrompt(input) }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama-Fehler ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    return parseSuggestion(input.documentId, data.message?.content ?? "");
  }
}
