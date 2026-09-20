import "server-only";
import OpenAI from "openai";
import type {
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ModelInfo,
  ProviderHealth,
  ProviderId,
} from "./provider.types";
import { ProviderError, toProviderError, withTimeout } from "./provider-errors";
import { getEnv } from "@/lib/config/env";
import { getModelRegistry } from "@/lib/config/model-config";

export interface OpenAICompatibleConfig {
  id: ProviderId;
  displayName: string;
  baseURL: () => string;
  apiKey: () => string;
  missingHint: string;
  defaultHeaders?: Record<string, string>;
  /**
   * Map a failing health probe to an operator-actionable reason.
   * Return undefined to use the generic message. Must never include
   * raw payloads or secrets — only safe hints.
   */
  unavailableHint?: (info: { status?: number; message: string }) => string | undefined;
}

function toSdkMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) =>
    m.role === "system"
      ? { role: "system", content: m.content }
      : m.role === "assistant"
        ? { role: "assistant", content: m.content }
        : { role: "user", content: m.content }
  );
}

/**
 * Shared core for OpenAI-compatible HTTP APIs (OpenRouter, NaroRouter).
 * One model per call — multi-model fallback lives in the FallbackManager.
 */
export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig): LLMProvider {
  function clientOrThrow(): OpenAI {
    const key = cfg.apiKey();
    if (!key) throw new ProviderError("AUTH", cfg.missingHint, { retryable: false });
    return new OpenAI({
      apiKey: key,
      baseURL: cfg.baseURL(),
      timeout: getEnv().requestTimeoutMs,
      maxRetries: 0, // HaSa router owns retry/fallback — no hidden SDK retries.
      defaultHeaders: cfg.defaultHeaders,
    });
  }

  function ensureModel(request: LLMRequest): string {
    if (!request.model) throw new ProviderError("INVALID_REQUEST", "Model is required.", { retryable: false });
    return request.model;
  }

  return {
    id: cfg.id,
    displayName: cfg.displayName,

    async generate(request: LLMRequest): Promise<LLMResponse> {
      const client = clientOrThrow();
      const model = ensureModel(request);
      if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
      try {
        const completion = await withTimeout(
          client.chat.completions.create(
            { model, messages: toSdkMessages(request.messages), temperature: request.temperature ?? 0.7 },
            request.signal ? { signal: request.signal } : undefined
          ),
          getEnv().requestTimeoutMs,
          `${cfg.displayName} generate`
        );
        const content = completion.choices[0]?.message?.content ?? "";
        const u = completion.usage as
          | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          | undefined;
        if (!content) throw new ProviderError("EMPTY_RESPONSE", "The provider returned an empty response.", { retryable: true });
        return {
          content,
          provider: cfg.displayName,
          model,
          usage: { promptTokens: u?.prompt_tokens, completionTokens: u?.completion_tokens, totalTokens: u?.total_tokens },
          finishReason: completion.choices[0]?.finish_reason,
          requestId: (completion as { id?: string }).id,
        };
      } catch (err) {
        throw toProviderError(err);
      }
    },

    async *stream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
      const client = clientOrThrow();
      const model = ensureModel(request);
      if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
      try {
        const stream = await withTimeout(
          client.chat.completions.create(
            {
              model,
              messages: toSdkMessages(request.messages),
              temperature: request.temperature ?? 0.7,
              stream: true,
              stream_options: { include_usage: true },
            },
            request.signal ? { signal: request.signal } : undefined
          ),
          getEnv().streamStartTimeoutMs,
          `${cfg.displayName} stream start`
        );
        for await (const chunk of stream) {
          if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
          const delta = chunk.choices[0]?.delta?.content ?? null;
          const finish = chunk.choices[0]?.finish_reason ?? undefined;
          const raw = (chunk as unknown as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
          const usage = raw
            ? { promptTokens: raw.prompt_tokens, completionTokens: raw.completion_tokens, totalTokens: raw.total_tokens }
            : undefined;
          if (delta || finish || usage) yield { content: delta ?? undefined, finishReason: finish ?? undefined, usage };
        }
      } catch (err) {
        throw toProviderError(err);
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const started = Date.now();
      try {
        const client = clientOrThrow();
        await withTimeout(client.models.list(), getEnv().requestTimeoutMs, `${cfg.displayName} health`);
        return { provider: cfg.id, available: true, latencyMs: Date.now() - started, checkedAt: new Date().toISOString() };
      } catch (err) {
        const code = err instanceof ProviderError ? err.code : "UNKNOWN";
        const status = err instanceof ProviderError ? err.status : (err as { status?: number })?.status;
        const message = err instanceof Error ? err.message : "";
        const hint = cfg.unavailableHint?.({ status, message });
        return {
          provider: cfg.id,
          available: false,
          latencyMs: Date.now() - started,
          checkedAt: new Date().toISOString(),
          reason:
            hint ??
            (code === "AUTH"
              ? `${cfg.displayName} credentials are missing or invalid.`
              : `${cfg.displayName} is unreachable.`),
        };
      }
    },

    getModels(): ModelInfo[] {
      return getModelRegistry().filter((m) => m.provider === cfg.id);
    },
  };
}
