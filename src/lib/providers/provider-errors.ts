/**
 * Normalized provider errors. Adapters translate every SDK/HTTP failure into
 * a ProviderError so the fallback manager can decide retry vs failover
 * WITHOUT parsing vendor-specific payloads. Never forward raw bodies to clients.
 */
export type ProviderErrorCode =
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "INVALID_REQUEST"
  | "CONTENT_FILTER"
  | "MODEL_UNAVAILABLE"
  | "SERVER"
  | "NETWORK"
  | "ABORTED"
  | "EMPTY_RESPONSE"
  | "UNKNOWN";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: ProviderErrorCode, message: string, opts: { retryable: boolean; status?: number } = { retryable: false }) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = opts.retryable;
    this.status = opts.status;
  }
}

/** Non-retryable by policy: auth, bad requests, filters, unknown models, aborts. */
const NON_RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set([
  "AUTH",
  "INVALID_REQUEST",
  "CONTENT_FILTER",
  "MODEL_UNAVAILABLE",
  "ABORTED",
]);

export function isRetryable(code: ProviderErrorCode): boolean {
  return !NON_RETRYABLE.has(code);
}

/** Classify an unknown SDK/HTTP error into a ProviderErrorCode. */
export function classifyError(err: unknown): ProviderErrorCode {
  if (err instanceof ProviderError) return err.code;
  const anyErr = err as { status?: number; code?: string | number; message?: string } | null;
  const status = typeof anyErr?.status === "number" ? anyErr.status : undefined;
  const code = String(anyErr?.code ?? "");
  const message = `${anyErr?.message ?? ""} ${code}`.toLowerCase();

  if (status === 401 || status === 403 || /unauthorized|invalid api key|authentication|forbidden|invalid_api_key/.test(message)) {
    // NOTE: some gateways use 403 for "model not entitled" — adapters should
    // disambiguate with MODEL_UNAVAILABLE where the body allows it.
    return "AUTH";
  }
  if (status === 404 || /model (not found|unavailable|does not exist)|not_found/.test(message)) return "MODEL_UNAVAILABLE";
  if (status === 429 || /rate ?limit|too many requests|quota/.test(message)) return "RATE_LIMIT";
  if (status === 400 || status === 413 || status === 415 || status === 422 || /validation|invalid request|bad request|too large|unsupported media/.test(message)) {
    return "INVALID_REQUEST";
  }
  if (/content (filter|policy)|blocked|safety|policy violation/.test(message)) return "CONTENT_FILTER";
  if (/timeout|timed out|deadline|abort/i.test(message) && /abort/i.test(code + message) && (anyErr as { name?: string })?.name === "APIUserAbortError") {
    return "ABORTED";
  }
  if (/timeout|timed out|deadline exceeded|etimedout/.test(message)) return "TIMEOUT";
  if (status !== undefined && status >= 500) return "SERVER";
  if (/econnreset|econnrefused|enotfound|socket|network|fetch failed|connection/.test(message)) return "NETWORK";
  return "UNKNOWN";
}

/** Wrap any error as a ProviderError (user-safe message, no raw payloads). */
export function toProviderError(err: unknown, fallback = "Provider request failed."): ProviderError {
  if (err instanceof ProviderError) return err;
  if ((err as Error)?.name === "AbortError")
    return new ProviderError("ABORTED", "Request was cancelled.", { retryable: false });
  const code = classifyError(err);
  // Transient set (spec): timeout, 429, outage/5xx, connection reset, unknown.
  const retryable =
    code === "TIMEOUT" ||
    code === "RATE_LIMIT" ||
    code === "SERVER" ||
    code === "NETWORK" ||
    code === "UNKNOWN";
  const status = (err as { status?: number })?.status;
  return new ProviderError(code, fallback, { retryable, status });
}

/** Friendly, non-technical message per code — safe for the browser. */
export function friendlyErrorMessage(code: ProviderErrorCode): { message: string; retryable: boolean } {
  switch (code) {
    case "RATE_LIMIT":
      return { message: "HaSa AI hit a provider rate limit. It is trying another available model.", retryable: true };
    case "TIMEOUT":
      return { message: "The model took too long to respond. HaSa AI is trying another available model.", retryable: true };
    case "SERVER":
    case "NETWORK":
    case "UNKNOWN":
      return { message: "HaSa AI could not use the selected model. It is trying another available model.", retryable: true };
    case "MODEL_UNAVAILABLE":
      return { message: "The selected model is currently unavailable. HaSa AI is trying another available model.", retryable: true };
    case "CONTENT_FILTER":
      return { message: "The response was blocked by a content filter. Try rephrasing your message.", retryable: false };
    case "AUTH":
      return { message: "A provider is misconfigured. The administrator has been notified.", retryable: false };
    case "INVALID_REQUEST":
      return { message: "The request could not be processed. Try shortening your message.", retryable: false };
    case "ABORTED":
      return { message: "Generation was stopped.", retryable: false };
    case "EMPTY_RESPONSE":
      return { message: "The model returned an empty response. Please retry or pick another mode.", retryable: true };
  }
}

/**
 * Race a promise against a timeout. Used for SDKs without native AbortSignal
 * support (Gemini) and as a backstop everywhere. Never logs the payload.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "provider request"): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProviderError("TIMEOUT", `${label} timed out after ${ms}ms.`, { retryable: true }));
    }, ms);
    (timer as unknown as { unref?: () => void }).unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
