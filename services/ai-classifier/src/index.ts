import { AnthropicClassifier } from "./anthropic-provider.js";
import type { Classifier } from "./types.js";

export type { ClassifyInput, Classifier } from "./types.js";

export interface AiClassifierConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
}

/**
 * KI-Erkennung ist optional (siehe Roadmap): ohne AI_PROVIDER/AI_API_KEY liefert
 * das hier `null` und der Rest der App läuft unverändert ohne Vorschläge weiter.
 */
export function createClassifier(config: AiClassifierConfig): Classifier | null {
  if (!config.provider) return null;

  switch (config.provider) {
    case "anthropic": {
      if (!config.apiKey) {
        throw new Error("AI_PROVIDER=anthropic erfordert AI_API_KEY");
      }
      return new AnthropicClassifier(config.apiKey, config.model ?? "claude-sonnet-5-5");
    }
    default:
      throw new Error(
        `Unbekannter AI_PROVIDER "${config.provider}". Unterstützt: anthropic (openai/ollama folgen ggf. später).`,
      );
  }
}
