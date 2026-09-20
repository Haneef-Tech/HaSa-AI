import "server-only";
import { ProviderRegistry } from "./provider-registry";
import type { ProviderId } from "./provider.types";
import { FallbackManager } from "@/lib/routing/fallback-manager";
import { mockProvider } from "./mock.provider";
import { groqProvider } from "./groq.provider";
import { geminiProvider } from "./gemini.provider";
import { openRouterProvider } from "./openrouter.provider";
import { narorouterProvider } from "./narorouter.provider";
import { getEnv } from "@/lib/config/env";
import { getAvailableModels } from "@/lib/config/model-config";

export * from "./provider.types";
export { mockProvider, MOCK_METADATA } from "./mock.provider";
export { groqProvider } from "./groq.provider";
export { geminiProvider } from "./gemini.provider";
export { openRouterProvider } from "./openrouter.provider";
export { narorouterProvider } from "./narorouter.provider";
export { ProviderRegistry } from "./provider-registry";
export { FallbackManager } from "@/lib/routing/fallback-manager";
export { selectModel, NoModelAvailableError } from "@/lib/routing/model-router";
export { classifyTask } from "@/lib/routing/task-classifier";
export { classifyIntent, chainForMode } from "./router";

const registry = new ProviderRegistry()
  .register(groqProvider)
  .register(geminiProvider)
  .register(openRouterProvider)
  .register(narorouterProvider);

const fallbackManager = new FallbackManager((id: string) => registry.getProvider(id as ProviderId));

export function getRegistry(): ProviderRegistry {
  return registry;
}

export function getFallbackManager(): FallbackManager {
  return fallbackManager;
}

/** IDs of real providers with credentials present. */
export function liveProviders(): string[] {
  if (getEnv().mockOnly) return [];
  const have = new Set(getAvailableModels().map((m) => m.provider));
  return registry.getAvailableProviders().map((p) => p.id).filter((id) => have.has(id));
}

export type ChatBackend =
  | { kind: "mock"; provider: typeof mockProvider }
  | { kind: "live"; registry: ProviderRegistry; fallback: FallbackManager };

/**
 * Chat-route entry point.
 * - LLM_MOCK_ONLY=true → deterministic mock (tests, offline dev).
 * - Otherwise live routing when ≥1 real provider is configured,
 *   else mock so chat never hard-fails in dev.
 */
export function getChatBackend(): ChatBackend {
  if (getEnv().mockOnly) return { kind: "mock", provider: mockProvider };
  if (liveProviders().length === 0) return { kind: "mock", provider: mockProvider };
  return { kind: "live", registry, fallback: fallbackManager };
}

export function describeChatProvider(provider: { id: string }): {
  provider: string;
  model: string;
  isMock: boolean;
} {
  if (provider.id === "hasa-mock") {
    return { provider: "HaSa Mock", model: "Preview Model", isMock: true };
  }
  return { provider: "HaSa Router", model: "auto-select", isMock: false };
}
