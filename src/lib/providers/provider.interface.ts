import type { ChatMode, Message } from "@/types/chat";

export interface StreamTelemetry {
  /** Filled by the serving provider when its stream finishes. */
  provider?: string;
  model?: string;
  isMock?: boolean;
  usage?: LLMResponse["tokenUsage"];
}

export interface LLMRequest {
  conversationId: string;
  userId: string;
  mode: ChatMode;
  /** Chronological context (oldest → newest), excluding the current message. */
  history: Pick<Message, "role" | "content">[];
  currentMessage: string;
  signal?: AbortSignal;
  /**
   * Mutable capture object. stream() fills it on success so callers get
   * provider identity + token usage from a SINGLE pass (no double billing).
   */
  telemetry?: StreamTelemetry;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  mode: ChatMode;
  isMock: boolean;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMStreamChunk {
  delta: string;
}

export interface LLMProvider {
  id: string;
  /** Human label for UI badges, e.g. "Groq". */
  label: string;
  /** False when the API key (or other config) is missing — router skips these. */
  configured: boolean;
  generate(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  healthCheck(): Promise<boolean>;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.33);
}
