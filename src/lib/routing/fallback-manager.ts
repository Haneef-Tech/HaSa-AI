import type {
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
  LLMUsage,
  ModelInfo,
} from "@/lib/providers/provider.types";
import { ProviderError, toProviderError, withTimeout } from "@/lib/providers/provider-errors";
import { noteRateLimited } from "@/lib/routing/circuit";
import type { RoutingDecision } from "@/lib/routing/model-router";

export interface FallbackMetadata {
  fallbackUsed: boolean;
  attemptedModels: string[];
  finalProvider: ModelInfo["provider"] | string;
  finalModel: string;
  reason?: string;
}

export interface ExecutionResult {
  content: string;
  usage?: LLMUsage;
  finishReason?: string;
  metadata: FallbackMetadata;
}

export interface StreamExecution {
  stream: AsyncIterable<LLMStreamChunk>;
  /** Resolves when the stream completes (or rejects with the final error). */
  done: Promise<ExecutionResult>;
}

/**
 * Executes a routed request across primary + fallbacks.
 * Rules (spec):
 * - retry/failover ONLY on transient errors (timeout, 429, 5xx, network);
 * - auth / invalid-request / content-filter / unknown-model fail fast;
 * - streaming fails over only before the first chunk (no forked transcripts);
 * - conversation context is preserved verbatim across attempts.
 */
export class FallbackManager {
  constructor(private resolve: (providerId: string) => LLMProvider | undefined) {}

  private providerFor(model: ModelInfo): LLMProvider {
    const p = this.resolve(model.provider);
    if (!p) throw new ProviderError("MODEL_UNAVAILABLE", `Provider ${model.provider} is not configured.`, { retryable: false });
    return p;
  }

  private toRequest(messages: LLMMessage[], model: string, signal?: AbortSignal) {
    return { messages, model, temperature: 0.7, signal };
  }

  async generate(
    decision: RoutingDecision,
    messages: LLMMessage[],
    signal?: AbortSignal
  ): Promise<LLMResponse & { fallback: FallbackMetadata }> {
    const attempted: string[] = [];
    let lastError: ProviderError | null = null;
    // Providers whose key/entitlement already proved bad this request —
    // skip their remaining models instead of retrying a dead key.
    const deadProviders = new Set<string>();
    for (const model of [decision.model, ...decision.fallbackModels]) {
      if (deadProviders.has(model.provider)) continue;
      const provider = this.providerFor(model);
      attempted.push(model.id);
      try {
        const res = await provider.generate(this.toRequest(messages, model.id, signal));
        return {
          ...res,
          model: model.id,
          fallback: {
            fallbackUsed: attempted.length > 1,
            attemptedModels: [...attempted],
            finalProvider: model.provider,
            finalModel: model.id,
          },
        };
      } catch (err) {
        lastError = toProviderError(err);
        if (lastError.code === "RATE_LIMIT") noteRateLimited(model.id);
        const raw = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
        console.error(`[fallback] generate ${model.id} failed (${lastError.code}): ${raw}`);
        if (signal?.aborted) break;
        // AUTH / MODEL_UNAVAILABLE mean THIS provider's key/entitlement is bad —
        // pointless to retry it, but a DIFFERENT provider may still serve.
        // Everything else non-retryable (filters, bad request, abort) fails fast.
        if (!lastError.retryable && lastError.code !== "AUTH" && lastError.code !== "MODEL_UNAVAILABLE") break;
        if (lastError.code === "AUTH" || lastError.code === "MODEL_UNAVAILABLE") {
          deadProviders.add(model.provider);
        }
      }
    }
    throw lastError ?? new ProviderError("UNKNOWN", "All models failed.", { retryable: true });
  }

  stream(
    decision: RoutingDecision,
    messages: LLMMessage[],
    signal?: AbortSignal
  ): StreamExecution {
    const attempted: string[] = [];
    let lastError: ProviderError | null = null;
    const self = this;

    async function* run(): AsyncIterable<LLMStreamChunk> {
      let fullContent = "";
      let usage: LLMUsage | undefined;
      let finishReason: string | undefined;
      // Same dead-key skipping as generate(): never retry a rejected key,
      // but still fail over to a different provider before any token flows.
      const deadProviders = new Set<string>();
      const idleMs = (() => {
        const n = parseInt(process.env.LLM_STREAM_IDLE_TIMEOUT_MS ?? "", 10);
        return Number.isFinite(n) && n > 0 ? n : 45_000;
      })();
      // Wall-clock budget per model attempt. Keepalive comments/dribbles
      // reset the idle timer but can never defeat this deadline.
      const budgetMs = (() => {
        const n = parseInt(process.env.LLM_MODEL_BUDGET_MS ?? "", 10);
        return Number.isFinite(n) && n > 0 ? n : 120_000;
      })();
      for (const model of [decision.model, ...decision.fallbackModels]) {
        if (deadProviders.has(model.provider)) continue;
        const provider = self.providerFor(model);
        attempted.push(model.id);
        let started = false;
        // Manual iterator (not for-await) so a stalled provider that never
        // terminates its stream fails over via idle timeout instead of
        // hanging the request forever.
        const it = provider.stream(self.toRequest(messages, model.id, signal))[Symbol.asyncIterator]();
        const deadline = Date.now() + budgetMs;
        try {
          for (;;) {
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
              try {
                await it.return?.();
              } catch {
                // best-effort cleanup
              }
              throw new ProviderError("TIMEOUT", `Model ${model.id} exceeded its time budget.`, { retryable: true });
            }
            let next: IteratorResult<LLMStreamChunk>;
            try {
              next = await withTimeout(it.next(), Math.min(idleMs, remaining), `stream idle (${model.id})`);
            } catch (timeoutErr) {
              try {
                await it.return?.();
              } catch {
                // best-effort cleanup
              }
              throw timeoutErr;
            }
            if (next.done) break;
            const chunk = next.value;
            if (chunk.content) {
              started = true;
              fullContent += chunk.content;
            }
            if (chunk.usage) usage = chunk.usage;
            if (chunk.finishReason) finishReason = chunk.finishReason;
            yield chunk;
          }
          const result: ExecutionResult = {
            content: fullContent,
            usage,
            finishReason,
            metadata: {
              fallbackUsed: attempted.length > 1,
              attemptedModels: [...attempted],
              finalProvider: model.provider,
              finalModel: model.id,
            },
          };
          resolveDone(result);
          return;
      } catch (err) {
        lastError = toProviderError(err);
        if (lastError.code === "RATE_LIMIT") noteRateLimited(model.id);
        // Server log carries the raw message (truncated, never prompts) so
        // ops can diagnose; clients only ever see the sanitized code.
        const raw = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
        console.error(`[fallback] stream ${model.id} failed (${lastError.code}): ${raw}`);
          // A rejected key/entitlement fails over to the next PROVIDER (never
          // a forked transcript: only before the first chunk was emitted).
          if (!started && (lastError.code === "AUTH" || lastError.code === "MODEL_UNAVAILABLE")) {
            deadProviders.add(model.provider);
            continue;
          }
          if (started || !lastError.retryable || signal?.aborted) throw lastError;
          // else: fail over to the next model before any token was emitted.
        }
      }
      const final = lastError ?? new ProviderError("UNKNOWN", "All models failed.", { retryable: true });
      rejectDone(final);
      throw final;
    }

    let resolveDone!: (r: ExecutionResult) => void;
    let rejectDone!: (e: unknown) => void;
    const done = new Promise<ExecutionResult>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    // Prevent unhandled rejection when callers only consume the stream.
    done.catch(() => {});
    return { stream: run(), done };
  }
}
