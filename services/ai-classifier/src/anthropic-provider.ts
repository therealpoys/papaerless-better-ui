import Anthropic from "@anthropic-ai/sdk";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { buildPrompt } from "./prompt.js";
import type { Classifier, ClassifyInput } from "./types.js";

interface RawSuggestion {
  title?: string | null;
  correspondent?: string | null;
  documentType?: string | null;
  tags?: string[] | null;
  date?: string | null;
  amount?: number | null;
  confidence?: number;
}

function parseSuggestion(documentId: number, text: string): MetadataSuggestion {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("KI-Antwort enthielt kein JSON-Objekt");
  }

  const raw = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as RawSuggestion;

  return {
    documentId,
    title: raw.title ?? undefined,
    correspondent: raw.correspondent ?? undefined,
    documentType: raw.documentType ?? undefined,
    tags: raw.tags ?? undefined,
    date: raw.date ?? undefined,
    amount: raw.amount ?? undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
  };
}

export class AnthropicClassifier implements Classifier {
  private readonly client: Anthropic;

  constructor(private readonly apiKey: string, private readonly model: string) {
    this.client = new Anthropic({ apiKey });
  }

  async classify(input: ClassifyInput): Promise<MetadataSuggestion> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return parseSuggestion(input.documentId, text);
  }
}
