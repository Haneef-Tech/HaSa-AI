import type { LLMRequest as LegacyRequest } from "./provider.interface";
import { classifyTask, type TaskType } from "@/lib/routing/task-classifier";
import type { ProviderId } from "./provider.types";

/**
 * Legacy Intent API (kept for compatibility + unit tests).
 * Backed by the spec task classifier: code→coding, reasoning→reasoning,
 * research/business map onto the closest spec tasks.
 */
export type Intent = "code" | "reasoning" | "research" | "business" | "general";

export function classifyIntent(text: string): Intent {
  const { task } = classifyTask(text);
  const map: Record<TaskType, Intent> = {
    coding: "code",
    reasoning: "reasoning",
    summarization: "research",
    "long-context": "research",
    creative: "business",
    "structured-output": "code",
    general: "general",
  };
  return map[task];
}

/**
 * Legacy ordered chains (kept for compatibility). The production path
 * (selectModel + FallbackManager) scores models instead of using these.
 */
export type ChainId = ProviderId | "hasa-mock";

export function chainForMode(mode: LegacyRequest["mode"], intent: Intent): ChainId[] {
  const MOCK: ChainId = "hasa-mock";
  switch (mode) {
    case "fast":
      return ["groq", "gemini", "narorouter", "openrouter", MOCK];
    case "balanced":
      return ["gemini", "groq", "narorouter", "openrouter", MOCK];
    case "reasoning":
      return ["openrouter", "gemini", "narorouter", "groq", MOCK];
    case "auto":
    default:
      switch (intent) {
        case "code":
          return ["groq", "gemini", "narorouter", "openrouter", MOCK];
        case "reasoning":
          return ["openrouter", "gemini", "narorouter", "groq", MOCK];
        case "research":
          return ["gemini", "narorouter", "openrouter", "groq", MOCK];
        case "business":
          return ["narorouter", "gemini", "openrouter", "groq", MOCK];
        case "general":
        default:
          return ["narorouter", "gemini", "groq", "openrouter", MOCK];
      }
  }
}

export type { ProviderId };
