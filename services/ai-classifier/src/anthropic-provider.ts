import type { MetadataSuggestion } from "@papaerless/shared-types";
import Anthropic from "@anthropic-ai/sdk";
import { parseSuggestion } from "./parse.js";
import { buildPrompt } from "./prompt.js";
import type { Classifier, ClassifyInput } from "./types.js";

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
