import { AnthropicClassifier } from "./anthropic-provider.js";
import { OllamaClassifier } from "./ollama-provider.js";
import type { Classifier } from "./types.js";

export type { ClassifyInput, Classifier } from "./types.js";

export interface AiClassifierConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  /** Nur für ollama: Basis-URL des Servers (Default http://localhost:11434). */
  baseUrl?: string;
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
    case "ollama": {
      if (!config.model) {
        throw new Error("AI_PROVIDER=ollama erfordert AI_MODEL (z. B. qwen3:4b-instruct-2507-q4_K_M)");
      }
      return new OllamaClassifier(config.baseUrl ?? "http://localhost:11434", config.model);
    }
    default:
      throw new Error(
        `Unbekannter AI_PROVIDER "${config.provider}". Unterstützt: anthropic, ollama.`,
      );
  }
}
