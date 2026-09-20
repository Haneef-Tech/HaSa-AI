import "server-only";
import Groq from "groq-sdk";
import type {
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ModelInfo,
  ProviderHealth,
} from "./provider.types";
import { ProviderError, toProviderError, withTimeout } from "./provider-errors";
import { getEnv } from "@/lib/config/env";
import { getRuntimeConfig } from "@/lib/config/runtime-config";
import { getModelRegistry } from "@/lib/config/model-config";

function toSdkMessages(messages: LLMMessage[]): Groq.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) =>
    m.role === "system"
      ? { role: "system", content: m.content }
      : m.role === "assistant"
        ? { role: "assistant", content: m.content }
        : { role: "user", content: m.content }
  );
}

function clientOrThrow(): Groq {
  const apiKey = getRuntimeConfig().groq.apiKey;
  if (!apiKey) throw new ProviderError("AUTH", "Groq is not configured.", { retryable: false });
  return new Groq({ apiKey, timeout: getEnv().requestTimeoutMs, maxRetries: 0 });
}

export const groqProvider: LLMProvider = {
  id: "groq",
  displayName: "Groq",

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const client = clientOrThrow();
    const { requestTimeoutMs } = getEnv();
    if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
    if (!request.model) throw new ProviderError("INVALID_REQUEST", "Model is required.", { retryable: false });
    try {
      const completion = await withTimeout(
        client.chat.completions.create(
          { model: request.model, messages: toSdkMessages(request.messages), temperature: request.temperature ?? 0.7 },
          request.signal ? { signal: request.signal } : undefined
        ),
        requestTimeoutMs,
        "Groq generate"
      );
      const content = completion.choices[0]?.message?.content ?? "";
      if (!content) {
        const refusal = (completion.choices[0]?.message as { refusal?: string } | undefined)?.refusal;
        if (refusal) throw new ProviderError("CONTENT_FILTER", "The response was blocked by a content filter.", { retryable: false });
      }
      return {
        content,
        provider: "Groq",
        model: request.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
        finishReason: completion.choices[0]?.finish_reason,
        requestId: (completion as { id?: string }).id,
      };
    } catch (err) {
      throw toProviderError(err);
    }
  },

  async *stream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const client = clientOrThrow();
    if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
    if (!request.model) throw new ProviderError("INVALID_REQUEST", "Model is required.", { retryable: false });
    type StreamChunk = {
      choices: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    type CreateFn = (
      body: {
        model: string;
        messages: Groq.Chat.ChatCompletionMessageParam[];
        temperature: number;
        stream: true;
        stream_options: { include_usage: boolean };
      },
      opts?: { signal?: AbortSignal }
    ) => AsyncIterable<StreamChunk>;
    try {
      // NOTE: bind preserves `this` — the SDK method reads internal client
      // state and throws otherwise (detaching it breaks every call).
      const create = client.chat.completions.create.bind(
        client.chat.completions
      ) as unknown as CreateFn;
      // Bound start timeout so a stalled handshake fails over fast.
      // (create() may return a thenable that settles on headers, or a plain
      // iterable — the async wrapper normalizes both for the timeout race.)
      const stream = await withTimeout(
        (async () =>
          create(
            {
              model: request.model,
              messages: toSdkMessages(request.messages),
              temperature: request.temperature ?? 0.7,
              stream: true,
              stream_options: { include_usage: true },
            },
            request.signal ? { signal: request.signal } : undefined
          ))(),
        getEnv().streamStartTimeoutMs,
        "Groq stream start"
      );
      for await (const chunk of stream) {
        if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
        const delta = chunk.choices[0]?.delta?.content ?? null;
        const finish = chunk.choices[0]?.finish_reason ?? undefined;
        const usage = chunk.usage
          ? {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            }
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
      await withTimeout(client.models.list(), getEnv().requestTimeoutMs, "Groq health");
      return { provider: "groq", available: true, latencyMs: Date.now() - started, checkedAt: new Date().toISOString() };
    } catch (err) {
      const code = err instanceof ProviderError ? err.code : "UNKNOWN";
      return {
        provider: "groq",
        available: false,
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        reason: code === "AUTH" ? "Groq credentials are missing or invalid." : "Groq is unreachable.",
      };
    }
  },

  getModels(): ModelInfo[] {
    return getModelRegistry().filter((m) => m.provider === "groq");
  },
};
