import type { ChatMode } from "@/types/chat";

/**
 * Pure routing policy: intent classification + provider chain ordering.
 * Deliberately free of SDK imports and `server-only` so it can be
 * unit-tested with tsx (see scripts/smoke-router.ts).
 */

export type Intent = "code" | "reasoning" | "research" | "business" | "general";

export const PROVIDER_IDS = ["groq", "gemini", "openrouter", "narorouter", "hasa-mock"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

const CODE_RE =
  /(python|typescript|javascript|code|function|bug|error|stack ?trace|refactor|fastapi|pipeline|script|algorithm|sql|regex|api|docker|npm|pip|compile|debug|test|class|async|loop|variable)/i;
const REASONING_RE =
  /(prove|proof|theorem|integral|derivative|equation|math\b|calculate|logic puzzle|riddle|chess|optimize|complexity|big-?o|recurrence|induction|contradiction|step-?by-?step reasoning|think (hard|deeply)|architecture tradeoff|design a (system|distributed))/i;
const RESEARCH_RE =
  /(explain|compare|analysis|research|survey|paper|history of|overview of|pros and cons|eli5|what is|how does|why does|long document|summarize|literature)/i;
const BUSINESS_RE =
  /(business|market|pricing|strategy|startup|revenue|idea|okrs?|pitch|gtm|unit economics|cac|memo)/i;

/**
 * Parse a comma-separated model list env var, e.g.
 * OPENROUTER_MODELS="a:free, b:free". Returns null when unset/empty so
 * callers fall back to the next precedence level. Pure + unit-tested.
 */
export function parseModelList(envValue: string | undefined): string[] | null {
  if (!envValue) return null;
  const list = envValue
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : null;
}

/** Keyword intent classifier - cheap, deterministic, runs before any LLM call. */
export function classifyIntent(text: string): Intent {
  if (REASONING_RE.test(text)) return "reasoning";
  if (CODE_RE.test(text)) return "code";
  if (BUSINESS_RE.test(text)) return "business";
  if (RESEARCH_RE.test(text)) return "research";
  return "general";
}

/**
 * Ordered provider chains per mode (legacy compatibility layer).
 * Production routing scores models via selectModel instead.
 * Conventions:
 * - fast: lowest-latency inference first (Groq).
 * - balanced: large-context quality first (Gemini).
 * - reasoning: deepest models first (OpenRouter).
 * - auto: intent-aware lanes; hasa-mock is ALWAYS last.
 */
export function chainForMode(mode: ChatMode, intent: Intent): ProviderId[] {
  switch (mode) {
    case "fast":
      return ["groq", "gemini", "narorouter", "openrouter", "hasa-mock"];
    case "balanced":
      return ["gemini", "groq", "narorouter", "openrouter", "hasa-mock"];
    case "reasoning":
      return ["openrouter", "gemini", "narorouter", "groq", "hasa-mock"];
    case "auto":
    default:
      switch (intent) {
        case "code":
          return ["groq", "gemini", "narorouter", "openrouter", "hasa-mock"];
        case "reasoning":
          return ["openrouter", "gemini", "narorouter", "groq", "hasa-mock"];
        case "research":
          return ["gemini", "narorouter", "openrouter", "groq", "hasa-mock"];
        case "business":
          return ["narorouter", "gemini", "openrouter", "groq", "hasa-mock"];
        case "general":
        default:
          return ["narorouter", "gemini", "groq", "openrouter", "hasa-mock"];
      }
  }
}
