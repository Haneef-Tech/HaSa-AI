import "server-only";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import { getRuntimeConfig } from "@/lib/config/runtime-config";

/**
 * NaroRouter adapter (spec "narorouter") — OpenAI-compatible AI gateway.
 * Base URL + key auth confirmed from https://router.bynara.id/docs:
 *   POST /v1/chat/completions, OpenAI SSE streaming, `auto/bynara` smart alias.
 * If the base URL or API key is missing, the provider reports unavailable and
 * the rest of the application continues normally. Kept isolated so the
 * endpoint mapping can be corrected later without touching other providers.
 * No undocumented endpoints are used.
 */
export const narorouterProvider = createOpenAICompatibleProvider({
  id: "narorouter",
  displayName: "NaroRouter",
  baseURL: () => getRuntimeConfig().narorouter.baseUrl ?? "https://router.bynara.id/v1",
  apiKey: () => getRuntimeConfig().narorouter.apiKey,
  missingHint: "NaroRouter is not configured (missing NAROROUTER_API_KEY).",
  unavailableHint: ({ message }) =>
    /telegram_required/i.test(message)
      ? "Account action required: bind Telegram in NaroRouter settings, then retry."
      : undefined,
});
