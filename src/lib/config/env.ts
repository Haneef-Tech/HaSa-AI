/**
 * Centralized, validated server env access for the LLM layer.
 * NOTE: no `server-only` guard here on purpose — this module only reads
 * process.env (never secrets in code) and must stay importable from the
 * tsx self-test. The browser boundary is enforced by the API routes:
 * only sanitized metadata ever leaves the server.
 */

interface EnvSnapshot {
  groqApiKey: string;
  geminiApiKey: string;
  openRouterApiKey: string;
  narorouterApiKey: string;
  narorouterBaseUrl: string;
  requestTimeoutMs: number;
  /** Cap for establishing a stream (headers). Slow starts fail over fast. */
  streamStartTimeoutMs: number;
  maxRetries: number;
  mockOnly: boolean;
}

let cache: EnvSnapshot | null = null;
let warned = false;

function num(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getEnv(): EnvSnapshot {
  if (cache) return cache;
  cache = {
    groqApiKey: process.env.GROQ_API_KEY ?? "",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
    // Canonical NAROROUTER_* with legacy NARA_* fallback (never commit either).
    narorouterApiKey: process.env.NAROROUTER_API_KEY ?? process.env.NARA_ROUTER_API_KEY ?? "",
    narorouterBaseUrl:
      process.env.NAROROUTER_BASE_URL ?? "https://router.bynara.id/v1",
    requestTimeoutMs: num(process.env.LLM_REQUEST_TIMEOUT_MS, 60_000),
    streamStartTimeoutMs: num(process.env.LLM_STREAM_START_TIMEOUT_MS, 25_000),
    maxRetries: Math.min(num(process.env.LLM_MAX_RETRIES, 1), 2),
    mockOnly: process.env.LLM_MOCK_ONLY === "true",
  };
  if (!warned) {
    warned = true;
    const missing: string[] = [];
    if (!cache.groqApiKey) missing.push("GROQ_API_KEY");
    if (!cache.geminiApiKey) missing.push("GEMINI_API_KEY");
    if (!cache.openRouterApiKey) missing.push("OPENROUTER_API_KEY");
    if (!cache.narorouterApiKey) missing.push("NAROROUTER_API_KEY");
    if (missing.length > 0 && !cache.mockOnly) {
      console.warn(`[llm-env] unconfigured providers will be skipped: ${missing.join(", ")}`);
    }
  }
  return cache;
}

/** Test hook — clears the cached snapshot (e.g. after env changes in tests). */
export function resetEnvCache(): void {
  cache = null;
  warned = false;
}
