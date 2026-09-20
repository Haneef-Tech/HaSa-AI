import type { ChatMode } from "@/types/chat";
import type { ModelInfo } from "@/lib/providers/provider.types";
import type { TaskType } from "@/lib/routing/task-classifier";

export interface ModelScoreFactors {
  capabilityMatch: number;
  modeMatch: number;
  speedScore: number;
  qualityScore: number;
  providerAvailability: number;
  contextFit: number;
}

export interface ScoredModel {
  model: ModelInfo;
  factors: ModelScoreFactors;
  total: number;
}

export const SCORING_WEIGHTS: Record<keyof ModelScoreFactors, number> = {
  capabilityMatch: 0.3,
  modeMatch: 0.2,
  speedScore: 0.2,
  qualityScore: 0.1,
  providerAvailability: 0.1,
  contextFit: 0.1,
};

const SPEED_VALUE = { fast: 1, medium: 0.6, slow: 0.3 } as const;
const QUALITY_VALUE = { standard: 0.5, high: 0.8, premium: 1 } as const;

/** Mode → preferred capability + speed/quality bias. */
export function modePreferences(mode: ChatMode): {
  capabilities: string[];
  preferSpeed: keyof typeof SPEED_VALUE | null;
  preferQuality: keyof typeof QUALITY_VALUE | null;
} {
  switch (mode) {
    case "fast":
      return { capabilities: ["general", "coding", "summarization"], preferSpeed: "fast", preferQuality: null };
    case "balanced":
      return { capabilities: ["general", "summarization", "long-context"], preferSpeed: null, preferQuality: "high" };
    case "reasoning":
      return { capabilities: ["reasoning", "coding", "long-context"], preferSpeed: null, preferQuality: "premium" };
    case "auto":
    default:
      return { capabilities: ["general"], preferSpeed: null, preferQuality: null };
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).length * 1.33);
}

export function estimatePromptTokens(messages: Array<{ content: string }>): number {
  return estimateTokens(messages.map((m) => m.content).join("\n"));
}

export function scoreModel(
  model: ModelInfo,
  task: TaskType,
  mode: ChatMode,
  promptTokens: number,
  healthyProviders: Set<string>
): ScoredModel {
  const prefs = modePreferences(mode);
  const needsCapability = task === "general" ? "general" : task;
  const hasExact = model.capabilities.includes(
    needsCapability as ModelInfo["capabilities"][number]
  );
  const hasGeneral = model.capabilities.includes("general");
  // Exact capability wins; a general model is an acceptable backup; else zero.
  const capabilityMatch = hasExact ? 1 : hasGeneral ? 0.5 : 0;

  const modeMatch = prefs.capabilities.some((c) =>
    model.capabilities.includes(c as ModelInfo["capabilities"][number])
  )
    ? 1
    : 0.4;

  const speedScore = SPEED_VALUE[model.speed];
  const qualityScore = QUALITY_VALUE[model.quality];
  const providerAvailability = healthyProviders.size === 0 || healthyProviders.has(model.provider) ? 1 : 0.2;

  let contextFit = 1;
  if (model.contextWindow && promptTokens > 0) {
    const usable = model.contextWindow * 0.7; // reserve 30% for the answer
    contextFit = promptTokens <= usable ? 1 : Math.max(0, 1 - (promptTokens - usable) / usable);
  }

  const factors: ModelScoreFactors = {
    capabilityMatch,
    modeMatch,
    speedScore: prefs.preferSpeed ? (model.speed === prefs.preferSpeed ? 1 : speedScore * 0.5) : speedScore,
    qualityScore: prefs.preferQuality
      ? QUALITY_VALUE[model.quality] >= QUALITY_VALUE[prefs.preferQuality]
        ? 1
        : qualityScore * 0.5
      : qualityScore,
    providerAvailability,
    contextFit,
  };

  const total = (Object.keys(SCORING_WEIGHTS) as Array<keyof ModelScoreFactors>).reduce(
    (sum, k) => sum + factors[k] * SCORING_WEIGHTS[k],
    0
  );
  return { model, factors, total };
}

/** Hard filters before scoring: enabled, streaming, context window fit. */
export function filterCandidates(models: ModelInfo[], promptTokens: number): ModelInfo[] {
  return models.filter((m) => {
    if (!m.enabled) return false;
    if (!m.supportsStreaming) return false;
    // Never select a model whose window is clearly too small (< 50% usable).
    if (m.contextWindow && promptTokens > m.contextWindow * 0.5) return false;
    return true;
  });
}
