import { createClassifier } from "@papaerless/ai-classifier";
import { env } from "./env.js";

export const classifier = createClassifier({
  provider: env.aiProvider,
  apiKey: env.aiApiKey,
  model: env.aiModel,
  baseUrl: env.aiBaseUrl,
});

export const aiEnabled = classifier !== null;
