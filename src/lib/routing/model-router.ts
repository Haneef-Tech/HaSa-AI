import type { ChatMode } from "@/types/chat";
import type { LLMMessage, ModelInfo, ProviderId } from "@/lib/providers/provider.types";
import { classifyTask, requiredCapability, type TaskClassification, type TaskType } from "@/lib/routing/task-classifier";
import { estimatePromptTokens, filterCandidates, scoreModel } from "@/lib/routing/routing-rules";
import { isCoolingDown } from "@/lib/routing/circuit";
import { findModel, getAvailableModels } from "@/lib/config/model-config";

export interface RoutingRequest {
  messages: LLMMessage[];
  mode: ChatMode;
  requestedModel?: string;
  /** Provider-only selection (UI exposes providers, not model IDs). */
  requestedProvider?: ProviderId;
  task?: TaskType;
  /** Providers known-healthy (empty = unknown, no penalty). */
  healthyProviders?: Set<string>;
}

export interface RoutingDecision {
  provider: ModelInfo["provider"];
  model: ModelInfo;
  task: TaskType;
  confidence: number;
  fallbackModels: ModelInfo[];
  /** Human-readable, user-safe explanation for badges/debug panels. */
  reason: string;
  manual: boolean;
}

export class NoModelAvailableError extends Error {
  constructor(message = "No AI model is currently configured. Set a provider API key or enable mock mode.") {
    super(message);
    this.name = "NoModelAvailableError";
  }
}

function humanReason(task: TaskType, model: ModelInfo, mode: ChatMode, manual: boolean): string {
  if (manual) return `Using ${model.displayName} as requested.`;
  const taskPhrase: Record<TaskType, string> = {
    general: "general conversation",
    coding: "coding",
    reasoning: "deep reasoning",
    summarization: "summarization",
    creative: "creative writing",
    "structured-output": "structured output",
    "long-context": "long document context",
  };
  const modePhrase =
    mode === "auto" ? "automatic routing" : mode === "fast" ? "low latency" : mode === "balanced" ? "balanced quality and speed" : "maximum reasoning depth";
  return `Selected ${model.displayName} for ${taskPhrase[task]} with ${modePhrase}.`;
}

export async function selectModel(request: RoutingRequest): Promise<RoutingDecision> {
  const { messages, mode } = request;
  const promptTokens = estimatePromptTokens(messages);
  const healthy = request.healthyProviders ?? new Set<string>();

  // Manual override first — validated, never trusted blindly.
  if (request.requestedModel) {
    const manual = findModel(request.requestedModel);
    if (!manual) {
      throw new NoModelAvailableError("The requested model is not available. Please choose another model or use automatic selection.");
    }
    if (!manual.enabled) {
      throw new NoModelAvailableError(`The requested model (${manual.displayName}) is currently unavailable. Please choose another model.`);
    }
    if (!manual.supportsStreaming) {
      throw new NoModelAvailableError(`The requested model (${manual.displayName}) does not support streaming.`);
    }
    const classification = request.task
      ? { task: request.task, confidence: 1, signals: ["manual"] }
      : classifyTask(messages[messages.length - 1]?.content ?? "");
    const fallbacks = getAvailableModels().filter((m) => m.id !== manual.id);
    return {
      provider: manual.provider,
      model: manual,
      task: classification.task,
      confidence: classification.confidence,
      fallbackModels: fallbacks,
      reason: humanReason(classification.task, manual, mode, true),
      manual: true,
    };
  }

  const classification: TaskClassification = request.task
    ? { task: request.task, confidence: 1, signals: ["explicit"] }
    : classifyTask(messages[messages.length - 1]?.content ?? "");

  const need = requiredCapability(classification.task);
  let pool = getAvailableModels();
  if (pool.length === 0) throw new NoModelAvailableError();

  // Provider-only selection: restrict the pool, then score normally inside it.
  let providerPinned: ProviderId | null = null;
  if (request.requestedProvider) {
    providerPinned = request.requestedProvider;
    pool = pool.filter((m) => m.provider === providerPinned);
    if (pool.length === 0) {
      throw new NoModelAvailableError(
        `The ${providerPinned} provider is currently unavailable. Please choose another provider.`
      );
    }
  }

  let candidates = filterCandidates(pool, promptTokens);
  if (candidates.length === 0) {
    // Relax the context filter before giving up (best-effort service).
    candidates = pool.filter((m) => m.enabled && m.supportsStreaming);
  }
  if (candidates.length === 0) throw new NoModelAvailableError();

  // Skip recently rate-limited models so we don't pay another failing
  // round-trip (nor burn more quota) — unless nothing else remains.
  const fresh = candidates.filter((m) => !isCoolingDown(m.id));
  if (fresh.length > 0) candidates = fresh;

  // Prefer capability-exact matches, but always keep general models as backup.
  const exact = candidates.filter((m) =>
    m.capabilities.includes(need as ModelInfo["capabilities"][number])
  );
  const scoredPool = (exact.length > 0 ? exact : candidates).map((m) =>
    scoreModel(m, classification.task, mode, promptTokens, healthy)
  );
  scoredPool.sort((a, b) => b.total - a.total);

  const primary = scoredPool[0].model;
  // Fallback list: next-best scored, then remaining enabled models for depth.
  const fallbackModels = [
    ...scoredPool.slice(1).map((s) => s.model),
    ...pool.filter((m) => !scoredPool.some((s) => s.model.id === m.id)),
  ];

  return {
    provider: primary.provider,
    model: primary,
    task: classification.task,
    confidence: classification.confidence,
    fallbackModels,
    reason: providerPinned
      ? `Using ${primary.displayName} on ${providerPinned} as requested.`
      : humanReason(classification.task, primary, mode, false),
    manual: providerPinned !== null,
  };
}
