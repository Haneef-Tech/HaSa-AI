/**
 * Central model registry. Model IDs/keys come from the RUNTIME config
 * (Firestore admin overrides > env > built-ins); entries with empty IDs are
 * filtered out, so the app runs with any subset of providers.
 * Capability/speed/quality metadata is static and honest per tier.
 * Never contains secrets.
 */
import type { ModelInfo } from "@/lib/providers/provider.types";
import { getRuntimeConfig } from "@/lib/config/runtime-config";

function buildRegistry(): ModelInfo[] {
  const rc = getRuntimeConfig();
  const all: ModelInfo[] = [
    ...rc.groq.models.slice(0, 1).map(
      (id): ModelInfo => ({
        id,
        provider: "groq",
        displayName: "Groq Fast",
        description: "Ultra-fast low-latency model for instant answers and quick code.",
        capabilities: ["general", "coding", "summarization"],
        supportsStreaming: true,
        speed: "fast",
        quality: "high",
        enabled: rc.groq.apiKey.length > 0,
      })
    ),
    ...rc.groq.models.slice(1).map(
      (id, i): ModelInfo => ({
        id,
        provider: "groq",
        displayName: `Groq Fallback ${i + 1}`,
        description: "Backup Groq model.",
        capabilities: ["general", "coding"],
        supportsStreaming: true,
        speed: "fast",
        quality: "standard",
        enabled: rc.groq.apiKey.length > 0,
      })
    ),
    ...rc.gemini.models.map(
      (id, i): ModelInfo => ({
        id,
        provider: "gemini",
        displayName: i === 0 ? "Gemini Flash" : `Gemini Lite`,
        description:
          i === 0
            ? "Balanced quality with a large context window."
            : "Lightweight backup with its own free quota.",
        capabilities: ["general", "summarization", "long-context"],
        contextWindow: 1_000_000,
        supportsStreaming: true,
        speed: "medium",
        quality: "high",
        enabled: rc.gemini.apiKey.length > 0,
      })
    ),
    ...rc.openrouter.models.map(
      (id, i): ModelInfo => ({
        id,
        provider: "openrouter",
        displayName: i === 0 ? "OpenRouter Reasoning" : `OpenRouter Fallback ${i}`,
        description:
          i === 0
            ? "Deep reasoning pool with automatic multi-model fallback."
            : "Backup reasoning model in the OpenRouter fallback chain.",
        capabilities: ["general", "reasoning", "coding", "creative"],
        supportsStreaming: true,
        speed: "slow",
        quality: "premium",
        enabled: rc.openrouter.apiKey.length > 0,
      })
    ),
    ...rc.narorouter.models.map(
      (id, i): ModelInfo => ({
        id,
        provider: "narorouter",
        displayName: i === 0 ? "NaroRouter Auto" : `NaroRouter Fallback ${i}`,
        description: "Cost-efficient gateway with smart auto-routing.",
        capabilities: ["general", "coding", "summarization", "creative"],
        supportsStreaming: true,
        speed: "medium",
        quality: "standard",
        enabled: rc.narorouter.apiKey.length > 0,
      })
    ),
  ];

  // Filter out models with empty IDs (unconfigured optionals).
  return all.filter((m) => m.id.trim().length > 0);
}

let cache: ModelInfo[] | null = null;

/** All models with non-empty IDs (enabled flag reflects key presence). */
export function getModelRegistry(): ModelInfo[] {
  if (!cache) cache = buildRegistry();
  return cache;
}

/** Only enabled models — the selectable pool. */
export function getAvailableModels(): ModelInfo[] {
  return getModelRegistry().filter((m) => m.enabled);
}

export function findModel(modelId: string): ModelInfo | undefined {
  return getModelRegistry().find((m) => m.id === modelId);
}

/** Test hook. */
export function resetModelRegistry(): void {
  cache = null;
}
