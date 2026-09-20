import type { ChatMode } from "@/types/chat";

/** Canonical provider IDs (spec). Legacy "nara" is normalized to "narorouter". */
export type ProviderId = "groq" | "gemini" | "openrouter" | "narorouter";

export type ModelCapability =
  | "general"
  | "coding"
  | "reasoning"
  | "creative"
  | "summarization"
  | "long-context"
  | "structured-output"
  | "vision";

export interface ModelInfo {
  id: string;
  provider: ProviderId;
  displayName: string;
  description: string;
  capabilities: ModelCapability[];
  contextWindow?: number;
  supportsStreaming: boolean;
  supportsVision?: boolean;
  supportsJson?: boolean;
  speed: "fast" | "medium" | "slow";
  quality: "standard" | "high" | "premium";
  enabled: boolean;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  usage?: LLMUsage;
  finishReason?: string;
  requestId?: string;
}

export interface LLMStreamChunk {
  content?: string;
  finishReason?: string;
  usage?: LLMUsage;
}

export interface ProviderHealth {
  provider: ProviderId;
  available: boolean;
  latencyMs?: number;
  /** ISO timestamp — safe to send to the browser. */
  checkedAt: string;
  /** Sanitized, user-safe reason. Never raw SDK payloads. */
  reason?: string;
}

export interface LLMProvider {
  id: ProviderId;
  displayName: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  healthCheck(): Promise<ProviderHealth>;
  getModels(): ModelInfo[];
}

/** Modes live in chat types; re-exported here for the routing layer. */
export type { ChatMode };
