import { PaperlessClient } from "@papaerless/paperless-client";
import { env } from "./env.js";

export const paperless = new PaperlessClient({
  baseUrl: env.paperlessUrl,
  apiToken: env.paperlessApiToken,
  timeoutMs: env.paperlessTimeoutMs,
});
