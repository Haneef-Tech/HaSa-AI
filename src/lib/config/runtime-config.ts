/**
 * Runtime provider configuration.
 * Precedence: Firestore `admin/provider-config` (set via Mission Control's
 * API section) > environment variables > built-in defaults.
 *
 * NOTE: no `server-only` guard here on purpose (same rationale as config/env):
 * reads are pure env/memory and must stay tsx-testable. Firestore is touched
 * only inside refreshRuntimeConfig() via lazy import. The browser boundary is
 * enforced by API routes — keys never leave the server.
 */
import { getEnv } from "@/lib/config/env";
import { parseModelList } from "@/lib/providers/routing-policy";

export interface RuntimeProviderEntry {
  /** Effective API key (Firestore override or env). Never leaves the server. */
  apiKey: string;
  /** True when the key came from Firestore rather than env. */
  fromAdmin: boolean;
  /** Effective ordered model list. */
  models: string[];
  /** NaroRouter only: effective base URL. */
  baseUrl?: string;
}

export interface RuntimeConfig {
  groq: RuntimeProviderEntry;
  gemini: RuntimeProviderEntry;
  openrouter: RuntimeProviderEntry;
  narorouter: RuntimeProviderEntry;
}

export type RuntimeProviderId = keyof RuntimeConfig;

const DEFAULTS: Record<RuntimeProviderId, { models: string[]; baseUrl?: string }> = {
  groq: { models: ["openai/gpt-oss-20b"] },
  // Lite second: per-model daily quotas — when flash 429s, lite still serves.
  gemini: { models: ["gemini-3.6-flash", "gemini-3.5-flash-lite"] },
  openrouter: {
    models: ["deepseek/deepseek-v4-flash-0731:free", "qwen/qwen3.8-27b:free", "z-ai/glm-5.2:free"],
  },
  // Single free default by policy; extend any time via admin or NARA_MODELS.
  narorouter: {
    models: ["agnes-2.5-flash"],
    baseUrl: "https://router.bynara.id/v1",
  },
};

function fromEnv(): RuntimeConfig {
  const env = getEnv();
  const pickModels = (
    listEnv: string | undefined,
    singleEnv: string | undefined,
    defaults: string[]
  ): string[] => parseModelList(listEnv) ?? (singleEnv ? [singleEnv] : defaults);
  // Legacy per-role pins are appended after the primary list.
  const withRoles = (models: string[], ...roles: Array<string | undefined>): string[] => {
    const extra = roles.filter((r): r is string => !!r && r.trim().length > 0).map((r) => r.trim());
    return [...models, ...extra.filter((e) => !models.includes(e))];
  };
  return {
    groq: {
      apiKey: env.groqApiKey,
      fromAdmin: false,
      models: withRoles(
        pickModels(undefined, process.env.GROQ_FAST_MODEL ?? process.env.GROQ_MODEL, DEFAULTS.groq.models),
        process.env.GROQ_CODING_MODEL
      ),
    },
    gemini: {
      apiKey: env.geminiApiKey,
      fromAdmin: false,
      models: withRoles(
        pickModels(
          [
            process.env.GEMINI_FAST_MODEL,
            process.env.GEMINI_REASONING_MODEL,
            process.env.GEMINI_LONG_CONTEXT_MODEL,
            process.env.GEMINI_MODELS,
          ]
            .filter(Boolean)
            .join(",") || undefined,
          process.env.GEMINI_MODEL,
          DEFAULTS.gemini.models
        )
      ),
    },
    openrouter: {
      apiKey: env.openRouterApiKey,
      fromAdmin: false,
      models: pickModels(
        process.env.OPENROUTER_GENERAL_MODEL
          ? [
              process.env.OPENROUTER_GENERAL_MODEL,
              process.env.OPENROUTER_CODING_MODEL,
              process.env.OPENROUTER_REASONING_MODEL,
            ]
              .filter(Boolean)
              .join(",")
          : process.env.OPENROUTER_MODELS,
        process.env.OPENROUTER_MODEL,
        DEFAULTS.openrouter.models
      ),
    },
    narorouter: {
      apiKey: env.narorouterApiKey,
      fromAdmin: false,
      models: pickModels(
        process.env.NAROROUTER_GENERAL_MODEL ?? process.env.NARA_MODELS,
        process.env.NARA_MODEL,
        DEFAULTS.narorouter.models
      ),
      baseUrl: env.narorouterBaseUrl,
    },
  };
}

let snapshot: RuntimeConfig | null = null;
let lastFetch = 0;
const REFRESH_TTL_MS = 60_000;

/** Synchronous effective config (env snapshot until Firestore loads). */
export function getRuntimeConfig(): RuntimeConfig {
  if (!snapshot) snapshot = fromEnv();
  return snapshot;
}

/** Applies an admin Firestore doc over env (exported for unit tests). */
export function applyFirestoreDoc(data: Record<string, unknown>): void {
  const base = fromEnv();
  const providers = (data.providers ?? {}) as Record<string, Record<string, unknown>>;
  const pick = (id: RuntimeProviderId): RuntimeProviderEntry => {
    const saved = providers[id] ?? {};
    const key = typeof saved.apiKey === "string" && (saved.apiKey as string).length > 0 ? (saved.apiKey as string) : base[id].apiKey;
    const models = Array.isArray(saved.models) && (saved.models as unknown[]).length > 0
      ? (saved.models as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
      : base[id].models;
    const entry: RuntimeProviderEntry = {
      apiKey: key,
      fromAdmin: key.length > 0 && key !== base[id].apiKey,
      models,
    };
    if (id === "narorouter") {
      entry.baseUrl =
        typeof saved.baseUrl === "string" && (saved.baseUrl as string).trim()
          ? (saved.baseUrl as string).trim()
          : base.narorouter.baseUrl;
    }
    return entry;
  };
  snapshot = { groq: pick("groq"), gemini: pick("gemini"), openrouter: pick("openrouter"), narorouter: pick("narorouter") };
  lastFetch = Date.now();
}

/**
 * Throttled Firestore refresh (fire-and-forget safe). Falls back to the
 * env snapshot on any failure — chat never blocks on config.
 */
export async function refreshRuntimeConfig(force = false): Promise<RuntimeConfig> {
  if (!force && snapshot && Date.now() - lastFetch < REFRESH_TTL_MS) return snapshot;
  try {
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const db = getAdminDb();
    if (!db) return getRuntimeConfig();
    const snap = await db.doc("admin/provider-config").get();
    if (snap.exists) applyFirestoreDoc(snap.data() as Record<string, unknown>);
    else {
      snapshot = fromEnv();
      lastFetch = Date.now();
    }
  } catch {
    if (!snapshot) snapshot = fromEnv();
  }
  return snapshot as RuntimeConfig;
}

/** Test hook. */
export function resetRuntimeConfig(): void {
  snapshot = null;
  lastFetch = 0;
}
