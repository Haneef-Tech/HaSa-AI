import "server-only";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import { getRuntimeConfig } from "@/lib/config/runtime-config";

/**
 * OpenRouter adapter — reasoning/deep-analysis tier.
 * OpenRouter itself does provider routing; HaSa keeps its own outer
 * fallback chain for task-aware selection across vendors.
 */
export const openRouterProvider = createOpenAICompatibleProvider({
  id: "openrouter",
  displayName: "OpenRouter",
  baseURL: () => "https://openrouter.ai/api/v1",
  apiKey: () => getRuntimeConfig().openrouter.apiKey,
  missingHint: "OpenRouter is not configured (missing OPENROUTER_API_KEY).",
  defaultHeaders: {
    // OpenRouter attribution headers (optional but recommended).
    "HTTP-Referer": "https://hasa-ai.local",
    "X-Title": "HaSa AI",
  },
});
