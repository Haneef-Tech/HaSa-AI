/**
 * HaSa routing self-test — no network, no real keys, no Firebase.
 * Run: npm run test:router   (tsx scripts/smoke-router.ts)
 *
 * selectModel tests inject DUMMY env keys (never real secrets) and reset the
 * config caches first. Scoring only — no provider is ever called.
 */
import assert from "node:assert/strict";

// Dummy keys BEFORE any config access (scoring path makes no network calls).
process.env.GROQ_API_KEY = "dummy-groq";
process.env.GEMINI_API_KEY = "dummy-gemini";
process.env.OPENROUTER_API_KEY = "dummy-openrouter";
process.env.NAROROUTER_API_KEY = "dummy-naro";

import {
  chainForMode,
  classifyIntent,
  parseModelList,
} from "../src/lib/providers/routing-policy";
import { classifyTask } from "../src/lib/routing/task-classifier";
import { selectModel, NoModelAvailableError } from "../src/lib/routing/model-router";
import { FallbackManager } from "../src/lib/routing/fallback-manager";
import { ProviderRegistry } from "../src/lib/providers/provider-registry";
import { ProviderError } from "../src/lib/providers/provider-errors";
import { resetEnvCache } from "../src/lib/config/env";
import { resetModelRegistry, getAvailableModels } from "../src/lib/config/model-config";
import { resetRuntimeConfig, applyFirestoreDoc, getRuntimeConfig } from "../src/lib/config/runtime-config";
import { noteRateLimited, isCoolingDown, resetCircuit } from "../src/lib/routing/circuit";
import { mockProvider } from "../src/lib/providers/mock.provider";
import { matchesIdentityQuery } from "../src/lib/context/identity";
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from "../src/lib/providers/provider.types";
import type { LLMRequest as LegacyRequest } from "../src/lib/providers/provider.interface";

function resetAllCaches() {
  resetEnvCache();
  resetModelRegistry();
  resetRuntimeConfig();
}

resetAllCaches();

let passed = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`ok - ${name}`);
    })
    .catch((err) => {
      console.error(`FAIL - ${name}: ${(err as Error).message}`);
      process.exitCode = 1;
    });
}

function msgs(text: string) {
  return [{ role: "user" as const, content: text }];
}

function stubProvider(
  id: LLMProvider["id"],
  behavior: "ok" | "transient" | "auth-fail"
): LLMProvider {
  return {
    id,
    displayName: id,
    getModels: () => [],
    async healthCheck() {
      return { provider: id, available: behavior === "ok", checkedAt: new Date().toISOString() };
    },
    async generate(req: LLMRequest): Promise<LLMResponse> {
      if (behavior === "ok") return { content: `served-by-${id}`, provider: id, model: req.model };
      if (behavior === "transient")
        throw new ProviderError("TIMEOUT", "simulated timeout", { retryable: true });
      throw new ProviderError("AUTH", "simulated bad key", { retryable: false });
    },
    async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
      if (behavior === "ok") {
        yield { content: `served-by-${id}` };
        yield { usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 } };
        return;
      }
      if (behavior === "transient")
        throw new ProviderError("TIMEOUT", "simulated timeout", { retryable: true });
      throw new ProviderError("AUTH", "simulated bad key", { retryable: false });
    },
  };
}

function legacyReq(text: string): LegacyRequest {
  return {
    conversationId: "test-conv",
    userId: "test-user",
    mode: "auto",
    history: [],
    currentMessage: text,
    telemetry: {},
  };
}

async function main(): Promise<void> {
  await check("legacy intent mapping", () => {
    assert.equal(classifyIntent("Fix this python traceback"), "code");
    assert.equal(classifyIntent("Prove the time complexity with induction"), "reasoning");
    assert.equal(classifyIntent("Hi there"), "general");
  });

  await check("legacy chains end with mock, narorouter present", () => {
    for (const mode of ["auto", "fast", "balanced", "reasoning"] as const) {
      const chain = chainForMode(mode, "general");
      assert.equal(chain[chain.length - 1], "hasa-mock");
      assert.ok(chain.includes("narorouter"), `${mode} must include narorouter`);
    }
    assert.equal(chainForMode("fast", "general")[0], "groq");
    assert.equal(chainForMode("reasoning", "general")[0], "openrouter");
  });

  await check("model list parsing", () => {
    assert.deepEqual(parseModelList(undefined), null);
    assert.deepEqual(parseModelList("  , "), null);
    assert.deepEqual(parseModelList("a:free, b:free ,, c"), ["a:free", "b:free", "c"]);
  });

  await check("spec classifier: tasks + confidence + signals", () => {
    const coding = classifyTask("Debug this python function, it throws an error");
    assert.equal(coding.task, "coding");
    assert.ok(coding.confidence > 0.5);
    assert.ok(coding.signals.length > 0);
    assert.equal(classifyTask("Prove sqrt(2) is irrational, compare approaches").task, "reasoning");
    assert.equal(classifyTask("Summarize the key points, TL;DR please").task, "summarization");
    assert.equal(classifyTask("Write a story and brainstorm slogans").task, "creative");
    assert.equal(classifyTask("Return only valid JSON matching this schema").task, "structured-output");
    assert.equal(classifyTask("Hello, how are you today?").task, "general");
    const long = classifyTask(`Here is the document:\n\n${"lorem ipsum dolor sit amet. ".repeat(400)}`);
    assert.equal(long.task, "long-context");
  });

  await check("model registry honors dummy env (no network)", () => {
    const models = getAvailableModels();
    assert.ok(models.length >= 4, "groq+gemini+openrouter+naro defaults");
    assert.ok(models.every((m) => m.id && m.enabled));
  });

  await check("selectModel: coding→fast lane, reasoning→deep lane", async () => {
    const code = await selectModel({ messages: msgs("Debug this python function"), mode: "auto" });
    assert.ok(["groq", "openrouter", "narorouter", "gemini"].includes(code.provider));
    assert.ok(code.fallbackModels.length > 0);
    assert.ok(code.reason.length > 10);
    const deep = await selectModel({ messages: msgs("Prove this theorem and analyze trade-offs"), mode: "reasoning" });
    assert.equal(deep.model.provider, "openrouter");
    const fast = await selectModel({ messages: msgs("Hello"), mode: "fast" });
    assert.equal(fast.model.provider, "groq");
  });

  await check("selectModel: provider-only selection honored", async () => {
    const d = await selectModel({ messages: msgs("Hello there"), mode: "auto", requestedProvider: "groq" });
    assert.equal(d.provider, "groq");
    assert.equal(d.manual, true);
    // Unconfigured provider must refuse with a clear error.
    delete process.env.GEMINI_API_KEY;
    resetAllCaches();
    await assert.rejects(
      selectModel({ messages: msgs("Hi"), mode: "auto", requestedProvider: "gemini" }),
      NoModelAvailableError
    );
    process.env.GEMINI_API_KEY = "dummy-gemini";
    resetAllCaches();
  });

  await check("selectModel: manual override validated", async () => {
    const models = getAvailableModels();
    const wanted = models[0].id;
    const d = await selectModel({ messages: msgs("Hi"), mode: "auto", requestedModel: wanted });
    assert.equal(d.model.id, wanted);
    assert.equal(d.manual, true);
    await assert.rejects(
      selectModel({ messages: msgs("Hi"), mode: "auto", requestedModel: "nope-not-a-model" }),
      NoModelAvailableError
    );
  });

  await check("selectModel: no providers → clear error", async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NAROROUTER_API_KEY;
    resetAllCaches();
    await assert.rejects(selectModel({ messages: msgs("Hi"), mode: "auto" }), NoModelAvailableError);
    // restore for remaining tests
    process.env.GROQ_API_KEY = "dummy-groq";
    process.env.GEMINI_API_KEY = "dummy-gemini";
    process.env.OPENROUTER_API_KEY = "dummy-openrouter";
    process.env.NAROROUTER_API_KEY = "dummy-naro";
    resetAllCaches();
  });

  await check("fallback: transient head → success + metadata", async () => {
    const byId: Record<string, LLMProvider> = {
      groq: stubProvider("groq", "transient"),
      gemini: stubProvider("gemini", "ok"),
    };
    const fm = new FallbackManager((id) => byId[id]);
    const decision = await selectModel({ messages: msgs("Hi"), mode: "fast" });
    // force the transient stub first regardless of scoring
    const forced = { ...decision, model: { ...decision.model, id: "forced", provider: "groq" as const }, fallbackModels: [{ ...decision.model, id: "fb", provider: "gemini" as const }] };
    const exec = fm.stream(forced, msgs("Hi"));
    let text = "";
    for await (const c of exec.stream) text += c.content ?? "";
    const result = await exec.done;
    assert.ok(text.includes("served-by-gemini"));
    assert.equal(result.metadata.fallbackUsed, true);
    assert.deepEqual(result.metadata.attemptedModels, ["forced", "fb"]);
    assert.equal(result.metadata.finalProvider, "gemini");
  });

  await check("fallback: AUTH fails fast (no retry storm)", async () => {
    let calls = 0;
    const counting: LLMProvider = {
      ...stubProvider("groq", "auth-fail"),
      async generate(req: LLMRequest): Promise<LLMResponse> {
        calls += 1;
        return stubProvider("groq", "auth-fail").generate(req);
      },
    };
    const fm = new FallbackManager(() => counting);
    const decision = await selectModel({ messages: msgs("Hi"), mode: "fast" });
    const forced = { ...decision, model: { ...decision.model, id: "x", provider: "groq" as const }, fallbackModels: [] };
    await assert.rejects(fm.generate(forced, msgs("Hi")), (e: unknown) => (e as ProviderError).code === "AUTH");
    assert.equal(calls, 1);
  });

  await check("registry: hot-path peek never blocks, refresh in background", async () => {
    const registry = new ProviderRegistry().register(stubProvider("groq", "ok"));
    assert.deepEqual(registry.peekHealth(), [], "cold cache = unknown, no penalty");
    assert.equal(registry.getProvider("groq")?.id, "groq");
    assert.equal(registry.getProvider("gemini"), undefined);
    const fresh = await registry.refreshHealth();
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0].available, true);
    assert.deepEqual(registry.peekHealth(), fresh, "cache populated for next request");
  });

  await check("runtime config: admin overrides shadow env", async () => {
    resetAllCaches();
    const before = getRuntimeConfig();
    assert.equal(before.groq.fromAdmin, false);
    applyFirestoreDoc({
      providers: {
        groq: { apiKey: "gsk_admin_override", models: ["admin-model-a", "admin-model-b"] },
        narorouter: { baseUrl: "https://custom.example/v1" },
      },
    });
    const after = getRuntimeConfig();
    assert.equal(after.groq.apiKey, "gsk_admin_override");
    assert.equal(after.groq.fromAdmin, true);
    assert.deepEqual(after.groq.models, ["admin-model-a", "admin-model-b"]);
    assert.equal(after.narorouter.baseUrl, "https://custom.example/v1");
    // Untouched providers keep env values.
    assert.equal(after.gemini.fromAdmin, false);
    resetAllCaches();
  });

  await check("circuit breaker skips 429 models, recovers pool", async () => {
    resetCircuit();
    assert.equal(isCoolingDown("m1"), false);
    noteRateLimited("m1");
    assert.equal(isCoolingDown("m1"), true);
    // Cooling model is skipped when alternatives exist.
    const d = await selectModel({ messages: msgs("Hello there"), mode: "auto" });
    assert.ok(!isCoolingDown(d.model.id) || getAvailableModels().length === 1);
    resetCircuit();
    assert.equal(isCoolingDown("m1"), false);
  });

  await check("identity: hypes Haneef only when asked", async () => {
    assert.equal(matchesIdentityQuery("Who is the developer of HaSa?"), true);
    assert.equal(matchesIdentityQuery("What does HaSa stand for?"), true);
    assert.equal(matchesIdentityQuery("Who built you?"), true);
    assert.equal(matchesIdentityQuery("Tell me about your creator"), true);
    assert.equal(matchesIdentityQuery("Write python code for me"), false);
    assert.equal(matchesIdentityQuery("What is the capital of France?"), false);
    const res = await mockProvider.generate(legacyReq("Who made you?"));
    assert.ok(res.content.includes("Haneef"));
    assert.ok(res.content.includes("HaneefSamrat"));
    const normal = await mockProvider.generate(legacyReq("Hello there"));
    assert.ok(!normal.content.includes("Haneef"));
  });

  console.log(`\n${passed} checks passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
}

void main();
