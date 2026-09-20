import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

function toContents(messages: LLMMessage[]): {
  systemInstruction?: string;
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
} {
  const systemTexts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const turns: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  const push = (role: "user" | "model", text: string) => {
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.parts.push({ text });
    else turns.push({ role, parts: [{ text }] });
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    push(m.role === "assistant" ? "model" : "user", m.content);
  }
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  if (turns.length === 0) throw new ProviderError("INVALID_REQUEST", "No user message provided.", { retryable: false });
  return {
    systemInstruction: systemTexts.length > 0 ? systemTexts.join("\n\n") : undefined,
    contents: turns,
  };
}

function throwIfBlocked(result: { response: { promptFeedback?: { blockReason?: string }; candidates?: Array<{ finishReason?: string }> } }): void {
  const blockReason = result.response.promptFeedback?.blockReason;
  const finish = result.response.candidates?.[0]?.finishReason;
  if (blockReason || finish === "SAFETY") {
    throw new ProviderError("CONTENT_FILTER", "The response was blocked by a content filter.", { retryable: false });
  }
}

export const geminiProvider: LLMProvider = {
  id: "gemini",
  displayName: "Google Gemini",

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
    try {
      const { systemInstruction, contents } = toContents(request.messages);
      // Rebuild with system instruction when present (kept inside adapter).
      const geminiApiKey = getRuntimeConfig().gemini.apiKey;
      if (!geminiApiKey) throw new ProviderError("AUTH", "Gemini is not configured.", { retryable: false });
      if (!request.model) throw new ProviderError("INVALID_REQUEST", "Model is required.", { retryable: false });
      const client = new GoogleGenerativeAI(geminiApiKey).getGenerativeModel({
        model: request.model,
        ...(systemInstruction ? { systemInstruction } : {}),
      });
      const result = await withTimeout(
        client.generateContent({ contents, generationConfig: { temperature: request.temperature ?? 0.7 } }),
        getEnv().requestTimeoutMs,
        "Gemini generate"
      );
      throwIfBlocked(result);
      const usage = result.response.usageMetadata;
      return {
        content: result.response.text(),
        provider: "Google Gemini",
        model: request.model,
        usage: {
          promptTokens: usage?.promptTokenCount,
          completionTokens: usage?.candidatesTokenCount,
          totalTokens: usage?.totalTokenCount,
        },
        finishReason: result.response.candidates?.[0]?.finishReason,
      };
    } catch (err) {
      throw toProviderError(err);
    }
  },

  async *stream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
    try {
      const geminiApiKey = getRuntimeConfig().gemini.apiKey;
      if (!geminiApiKey) throw new ProviderError("AUTH", "Gemini is not configured.", { retryable: false });
      if (!request.model) throw new ProviderError("INVALID_REQUEST", "Model is required.", { retryable: false });
      const { systemInstruction, contents } = toContents(request.messages);
      const client = new GoogleGenerativeAI(geminiApiKey).getGenerativeModel({
        model: request.model,
        ...(systemInstruction ? { systemInstruction } : {}),
      });
      // NOTE: @google/generative-ai has no AbortSignal support — the route
      // aborts via client disconnect + best-effort checks between chunks.
      const result = await withTimeout(
        client.generateContentStream({ contents, generationConfig: { temperature: request.temperature ?? 0.7 } }),
        getEnv().streamStartTimeoutMs,
        "Gemini stream start"
      );
      for await (const chunk of result.stream) {
        if (request.signal?.aborted) throw new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
        const text = chunk.text();
        if (text) yield { content: text };
      }
      const final = await result.response;
      throwIfBlocked({ response: final });
      const usage = final.usageMetadata;
      if (usage) {
        yield {
          usage: {
            promptTokens: usage.promptTokenCount,
            completionTokens: usage.candidatesTokenCount,
            totalTokens: usage.totalTokenCount,
          },
          finishReason: final.candidates?.[0]?.finishReason,
        };
      }
    } catch (err) {
      throw toProviderError(err);
    }
  },

  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      const geminiApiKey = getRuntimeConfig().gemini.apiKey;
      if (!geminiApiKey) throw new ProviderError("AUTH", "Gemini is not configured.", { retryable: false });
      const client = new GoogleGenerativeAI(geminiApiKey).getGenerativeModel({ model: "gemini-3.6-flash" });
      // countTokens, NOT generateContent: proves key + reachability without
      // burning the tiny free-tier generation quota.
      await withTimeout(client.countTokens("ping"), getEnv().requestTimeoutMs, "Gemini health");
      return { provider: "gemini", available: true, latencyMs: Date.now() - started, checkedAt: new Date().toISOString() };
    } catch (err) {
      const code = err instanceof ProviderError ? err.code : "UNKNOWN";
      return {
        provider: "gemini",
        available: false,
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        reason: code === "AUTH" ? "Gemini credentials are missing or invalid." : "Gemini is unreachable.",
      };
    }
  },

  getModels(): ModelInfo[] {
    return getModelRegistry().filter((m) => m.provider === "gemini");
  },
};
