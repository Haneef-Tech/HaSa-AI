import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { badRequest, internalError, zodDetails } from "@/lib/server/errors";
import { getRuntimeConfig, refreshRuntimeConfig, type RuntimeProviderId } from "@/lib/config/runtime-config";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  ENV_VAR_MAP,
  maskKey,
  readEnvFileValues,
  upsertEnvFileValues,
} from "@/lib/server/env-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guard(): { ok: true } | { ok: false; response: Response } {
  try {
    requireAdminSession();
    return { ok: true };
  } catch (res) {
    if (res instanceof Response) return { ok: false, response: res };
    return { ok: false, response: internalError() };
  }
}

const PROVIDER_IDS: RuntimeProviderId[] = ["groq", "gemini", "openrouter", "narorouter"];

/**
 * Safe view — key presence + masked hints only, never key material.
 * `.env.local` is read from disk so manual file edits appear in the panel
 * without a restart (process.env is frozen at boot).
 */
async function safeView() {
  const rc = getRuntimeConfig();
  const { values: fileValues } = await readEnvFileValues();
  return {
    providers: Object.fromEntries(
      PROVIDER_IDS.map((id) => {
        const keyVars = ENV_VAR_MAP[id].keyVars as readonly string[];
        const envKeyFromFile = keyVars.map((v) => fileValues.get(v) ?? "").find((v) => v.length > 0) ?? "";
        return [
          id,
          {
            hasKey: rc[id].apiKey.length > 0,
            fromAdmin: rc[id].fromAdmin,
            source: rc[id].apiKey.length === 0 ? "none" : rc[id].fromAdmin ? "admin" : "env",
            envHasKey: envKeyFromFile.length > 0,
            maskedHint: rc[id].apiKey.length > 0 ? maskKey(rc[id].apiKey) : "",
            models: rc[id].models,
            ...(id === "narorouter" ? { baseUrl: rc.narorouter.baseUrl ?? null } : {}),
          },
        ];
      })
    ),
    firestoreBacked: isFirebaseAdminConfigured(),
    envFile: ".env.local",
  };
}

export async function GET() {
  const g = guard();
  if (!g.ok) return g.response;
  try {
    await refreshRuntimeConfig(true).catch(() => {});
    return Response.json(await safeView());
  } catch (err) {
    console.error("[GET /api/admin/api-config]", err instanceof Error ? err.message : err);
    return internalError();
  }
}

const providerPatch = z.object({
  // Omitted = leave unchanged. Empty string = clear override (back to env).
  apiKey: z.string().max(500).optional(),
  models: z.array(z.string().trim().min(1).max(256)).max(10).optional(),
  baseUrl: z.string().trim().max(256).optional(),
});

const saveSchema = z.object({
  providers: z.object({
    groq: providerPatch.optional(),
    gemini: providerPatch.optional(),
    openrouter: providerPatch.optional(),
    narorouter: providerPatch.optional(),
  }),
});

const KEY_HINTS: Record<RuntimeProviderId, RegExp[]> = {
  groq: [/^gsk_/],
  gemini: [/^AIza/, /^AQ\./],
  openrouter: [/^sk-or-/],
  narorouter: [/^sk-nry-/],
};

export async function PUT(req: NextRequest) {
  const g = guard();
  if (!g.ok) return g.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid API config payload.", zodDetails(parsed.error.issues));
  if (!isFirebaseAdminConfigured()) {
    return internalError("Firebase Admin is not configured — runtime key storage needs Firestore.");
  }
  try {
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const db = getAdminDb();
    if (!db) throw new Error("Admin backend unavailable.");
    const ref = db.doc("admin/provider-config");
    const snap = await ref.get();
    const existing = (snap.exists ? (snap.data() as Record<string, unknown>) : {}) as {
      providers?: Record<string, Record<string, unknown>>;
    };
    const providers: Record<string, Record<string, unknown>> = { ...(existing.providers ?? {}) };
    const warnings: string[] = [];
    // Collect dotenv updates so admin changes also land in .env.local +
    // live process.env (bidirectional sync). Clears (revert-to-env) intentionally
    // leave the file untouched — the file IS the fallback.
    const envUpdates: Record<string, string> = {};

    for (const id of PROVIDER_IDS) {
      const patch = parsed.data.providers[id];
      if (!patch) continue;
      const entry: Record<string, unknown> = { ...(providers[id] ?? {}) };
      if (patch.apiKey !== undefined) {
        const key = patch.apiKey.trim();
        if (key.length === 0) {
          delete entry.apiKey; // clear override → env takes over
        } else {
          entry.apiKey = key;
          if (!KEY_HINTS[id].some((re) => re.test(key))) {
            warnings.push(`${id}: key does not look like a typical ${id} key — saved anyway, verify it.`);
          }
          // Sync the new key into .env.local + process.env.
          for (const v of ENV_VAR_MAP[id].keyVars) envUpdates[v] = key;
        }
      }
      if (patch.models !== undefined) {
        const models = patch.models.map((m) => m.trim()).filter(Boolean);
        if (models.length === 0) {
          delete entry.models;
        } else {
          entry.models = models;
          const modelsVar = ENV_VAR_MAP[id].modelsVar as string;
          envUpdates[modelsVar] = models.join(",");
        }
      }
      if (patch.baseUrl !== undefined && id === "narorouter") {
        const url = patch.baseUrl.trim();
        if (!url) delete entry.baseUrl;
        else if (!/^https?:\/\/.+\..+/.test(url)) {
          return badRequest("NaroRouter base URL must start with http(s):// and contain a host.");
        } else {
          const clean = url.replace(/\/+$/, "");
          entry.baseUrl = clean;
          envUpdates[ENV_VAR_MAP.narorouter.baseUrlVar] = clean;
        }
      }
      providers[id] = entry;
    }

    await ref.set(
      { providers, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    // Bidirectional sync: persist to .env.local + live environment variables.
    if (Object.keys(envUpdates).length > 0) {
      try {
        await upsertEnvFileValues(envUpdates);
      } catch (err) {
        warnings.push(`Firestore saved, but .env.local sync failed: ${err instanceof Error ? err.message : "write error"}.`);
      }
      try {
        const { resetEnvCache } = await import("@/lib/config/env");
        resetEnvCache();
      } catch {
        // cache rebuilds lazily — never fail the save over this
      }
    }
    // Instant apply: rebuild runtime snapshot + model registry + health,
    // so the very next chat uses the new keys/models (no restart).
    await refreshRuntimeConfig(true).catch(() => {});
    let health: Record<string, { available: boolean; reason?: string }> | undefined;
    try {
      const { resetModelRegistry } = await import("@/lib/config/model-config");
      resetModelRegistry();
      const { getRegistry } = await import("@/lib/providers/index");
      getRegistry().invalidateHealth();
      const results = await getRegistry().refreshHealth();
      health = Object.fromEntries(
        results.map((r) => [r.provider, { available: r.available, ...(r.reason ? { reason: r.reason } : {}) }])
      );
      // Surface a Gemini-specific check result automatically after every save.
      const gemini = health["gemini"];
      if (gemini && !gemini.available) {
        warnings.push("Gemini check: key saved but health probe failed — verify the key and quota.");
      }
    } catch {
      // caches rebuild lazily — never fail the save over this
    }
    return Response.json({ ok: true, ...(await safeView()), warnings, health });
  } catch (err) {
    console.error("[PUT /api/admin/api-config]", err instanceof Error ? err.message : err);
    return internalError();
  }
}

const testSchema = z.object({
  provider: z.enum(["groq", "gemini", "openrouter", "narorouter"]),
  // Omitted = test the currently effective key; provided = test this draft key.
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().trim().max(256).optional(),
});

/**
 * POST /api/admin/api-config/test — verify a provider key LIVE without saving.
 * Gemini uses countTokens (no generation quota burn); OpenAI-compatible
 * providers hit GET {base}/models with the candidate key.
 */
export async function POST(req: NextRequest) {
  const g = guard();
  if (!g.ok) return g.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid test payload.", zodDetails(parsed.error.issues));
  const { provider, baseUrl } = parsed.data;
  const rc = getRuntimeConfig();
  const candidate = (parsed.data.apiKey ?? "").trim() || rc[provider].apiKey;
  if (!candidate) {
    return Response.json({ ok: false, provider, message: "No key to test — paste a key first." });
  }
  if (provider === "gemini" && !KEY_HINTS.gemini.some((re) => re.test(candidate))) {
    return Response.json({ ok: false, provider, message: "Key format doesn't look like a Gemini key (expected AIza… or AQ.…)." });
  }
  const started = Date.now();
  try {
    if (provider === "gemini") {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const client = new GoogleGenerativeAI(candidate).getGenerativeModel({ model: "gemini-3.6-flash" });
      const timeoutMs = 20_000;
      await Promise.race([
        client.countTokens("ping"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
      ]);
      return Response.json({ ok: true, provider, latencyMs: Date.now() - started, message: "Gemini key is valid and reachable." });
    }
    const base =
      provider === "groq"
        ? "https://api.groq.com/openai/v1"
        : provider === "openrouter"
          ? "https://openrouter.ai/api/v1"
          : (baseUrl?.trim() || rc.narorouter.baseUrl || "https://router.bynara.id/v1").replace(/\/+$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${candidate}` },
        signal: ctrl.signal,
      });
      if (res.status === 401 || res.status === 403) {
        return Response.json({ ok: false, provider, latencyMs: Date.now() - started, message: "Key was rejected (401/403) — check the value." });
      }
      if (!res.ok) {
        return Response.json({ ok: false, provider, latencyMs: Date.now() - started, message: `Endpoint returned ${res.status} — key may be valid but the gateway errored.` });
      }
      return Response.json({ ok: true, provider, latencyMs: Date.now() - started, message: "Key is valid and reachable." });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unreachable";
    return Response.json({
      ok: false,
      provider,
      latencyMs: Date.now() - started,
      message: /timeout|abort/i.test(msg) ? "Timed out — check network or try again." : "Key test failed — verify the value and try again.",
    });
  }
}
