import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/firestore";
import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { badRequest, errorResponse, internalError, notFound, rateLimited, zodDetails } from "@/lib/server/errors";
import { getRateLimiter, RATE_LIMITS } from "@/lib/server/rate-limit";
import { verifyConversationOwner } from "@/lib/server/conversations";
import { buildConversationContext } from "@/lib/context/conversation-context";
import { IDENTITY_PREAMBLE } from "@/lib/context/identity";
import { chatRequestSchema } from "@/lib/validation/chat-schemas";
import { getChatBackend } from "@/lib/providers/index";
import { classifyTask } from "@/lib/routing/task-classifier";
import { NoModelAvailableError, selectModel } from "@/lib/routing/model-router";
import { refreshRuntimeConfig } from "@/lib/config/runtime-config";
import { ProviderError, friendlyErrorMessage } from "@/lib/providers/provider-errors";
import { recordUsage } from "@/lib/usage/usage-tracker";
import type { LLMMessage, ProviderId } from "@/lib/providers/provider.types";
import type { LLMRequest as LegacyLLMRequest, StreamTelemetry } from "@/lib/providers/provider.interface";
import type { MockProvider } from "@/lib/providers/mock.provider";
import type { ChatStreamEvent, Message } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseEncode(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// Best-effort duplicate prevention: one live generation per conversation per
// instance. Cleared on completion/error/abort (see finally blocks below).
const inFlight = new Set<string>();

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuthenticatedUser(req);
  } catch (res) {
    if (res instanceof Response) return res;
    console.error("[auth] unexpected error", res);
    return internalError();
  }

  const limiter = getRateLimiter();
  const rl = await limiter.check(`chat:${user.uid}`, RATE_LIMITS.chat.limit, RATE_LIMITS.chat.windowMs);
  if (!rl.allowed) return rateLimited(rl.retryAfterMs);

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const emptyMessage = parsed.error.issues.some(
      (i) => String(i.path[0]) === "message" && i.code === "too_small"
    );
    return badRequest(
      emptyMessage ? "Message cannot be empty." : "Invalid chat payload.",
      zodDetails(parsed.error.issues)
    );
  }
  const { conversationId, message: userText, mode, requestedModel, requestedProvider } = parsed.data;

  // Duplicate-generation guard (e.g. a model switch restarting while the old
  // stream is still tearing down). 409 — NOT 429 — so clients auto-retry once
  // after the old stream releases instead of surfacing a rate-limit error.
  if (inFlight.has(conversationId)) {
    return errorResponse(
      "CONFLICT",
      "A response is already being generated for this conversation.",
      409,
      { retryAfterMs: 1500 }
    );
  }

  try {
    const db = getAdminDb();
    const found = await verifyConversationOwner(user.uid, conversationId);
    if (!found) return notFound("CONVERSATION_NOT_FOUND", "The requested conversation could not be found.");

    // 1. Save user message first.
    // Dedupe guard for model/provider switch-restart: if the previous stream
    // was aborted before the assistant reply was saved, the last stored doc
    // is the same user message. Re-saving would duplicate it and pollute
    // the context window (quality/reasoning degradation), so reuse it.
    const msgsColForDedupe = db.collection(firestorePaths.messages(user.uid, conversationId));
    try {
      const lastSnap = await msgsColForDedupe.orderBy("createdAt", "desc").limit(1).get();
      const last = lastSnap.docs[0]?.data() as { role?: string; content?: string } | undefined;
      if (!(last && last.role === "user" && last.content === userText)) {
        await msgsColForDedupe.add({
          role: "user",
          content: userText,
          createdAt: FieldValue.serverTimestamp(),
          mode,
        });
      }
    } catch {
      // Best-effort dedupe — never block chat on this check.
      await msgsColForDedupe.add({
        role: "user",
        content: userText,
        createdAt: FieldValue.serverTimestamp(),
        mode,
      });
    }

    // 2. Build context (latest history, chronological, capped).
    const context = await buildConversationContext(user.uid, conversationId, userText);

    // 3. Normalized LLM messages: identity preamble + history + current.
    //    Client can never inject provider/model — only the registry decides.
    const llmMessages: LLMMessage[] = [
      { role: "system", content: IDENTITY_PREAMBLE },
      ...context.history.map((h): LLMMessage => ({
        role: h.role === "assistant" ? "assistant" : h.role === "system" ? "system" : "user",
        content: h.content,
      })),
      { role: "user", content: userText },
    ];

    // 4. Pre-generate assistant doc id for metadata event.
    const msgsCol = db.collection(firestorePaths.messages(user.uid, conversationId));
    const assistantRef = msgsCol.doc();
    const assistantMessageId = assistantRef.id;

    const backend = getChatBackend();
    const aborter = new AbortController();
    inFlight.add(conversationId);
    // Client disconnect (Stop / model switch) releases the guard EAGERLY so a
    // switch-restart issued ~1s later isn't rejected as a duplicate. Provider
    // teardown still continues via aborter; the finally blocks below delete
    // idempotently as well.
    req.signal.addEventListener(
      "abort",
      () => {
        inFlight.delete(conversationId);
        aborter.abort();
      },
      { once: true }
    );
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: ChatStreamEvent) => controller.enqueue(encoder.encode(sseEncode(e)));
        const startedAt = Date.now();
        const fail = (code: string, message: string, retryable: boolean) => {
          send({ type: "error", code, message, retryable });
        };
        try {
          if (backend.kind === "mock") {
            await runMock(controller, send, {
              backend: backend.provider,
              userId: user.uid,
              conversationId,
              mode,
              history: context.history.map((h) => ({ role: h.role, content: h.content })),
              userText,
              assistantRef,
              foundRef: found.ref,
              assistantMessageId,
              startedAt,
            });
          } else {
            await runLive(controller, send, {
              backend,
              userId: user.uid,
              conversationId,
              mode,
              requestedModel,
              requestedProvider,
              llmMessages,
              assistantRef,
              foundRef: found.ref,
              assistantMessageId,
              startedAt,
              signal: aborter.signal,
            });
          }
        } catch (err) {
          if (aborter.signal.aborted || (err as Error)?.name === "AbortError") {
            // Client went away — partial content is discarded, not saved.
            try {
              controller.close();
            } catch {
              // already closed
            }
            return;
          }
          const code = (err as { code?: string }).code ?? "UNKNOWN";
          if (code === "NO_MODEL") {
            fail("NO_MODEL", err instanceof Error ? err.message : "No model is available.", false);
          } else if (
            code === "AUTH" &&
            (requestedProvider || requestedModel)
          ) {
            // Explicit pin: tell the user WHICH provider's key failed and where
            // to fix it, instead of a generic "misconfigured" message.
            const pinned = requestedProvider ?? "selected";
            fail(
              "AUTH",
              `The ${pinned} API key was rejected. Ask an admin to verify it in Mission Control → API Keys → Check key.`,
              false
            );
          } else {
            const friendly = friendlyErrorMessage(
              err instanceof ProviderError ? err.code : "UNKNOWN"
            );
            fail(err instanceof ProviderError ? err.code : "UNKNOWN", friendly.message, friendly.retryable);
          }
          console.error("[POST /api/chat] stream error", err instanceof Error ? err.message : err);
        } finally {
          inFlight.delete(conversationId);
          try {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch {
            // client already gone
          }
        }
      },
      cancel() {
        aborter.abort();
        inFlight.delete(conversationId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    inFlight.delete(conversationId);
    const code = (err as Error & { code?: string }).code;
    if (code === "CONVERSATION_NOT_FOUND") {
      return notFound("CONVERSATION_NOT_FOUND", "The requested conversation could not be found.");
    }
    console.error("[POST /api/chat]", err instanceof Error ? err.message : err);
    return internalError();
  }
}

interface MockRun {
  backend: MockProvider;
  userId: string;
  conversationId: string;
  mode: "auto" | "fast" | "balanced" | "reasoning";
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  userText: string;
  assistantRef: FirebaseFirestore.DocumentReference;
  foundRef: FirebaseFirestore.DocumentReference;
  assistantMessageId: string;
  startedAt: number;
}

async function runMock(
  _controller: ReadableStreamDefaultController,
  send: (e: ChatStreamEvent) => void,
  args: MockRun
) {
  const { describeChatProvider: describe } = await import("@/lib/providers/index");
  const head = describe({ id: "hasa-mock" });
  const task = classifyTask(args.userText).task;
  send({
    type: "metadata",
    messageId: args.assistantMessageId,
    provider: head.provider,
    model: head.model,
    mode: args.mode,
    task,
    fallbackUsed: false,
    isMock: true,
  });
  const telemetry: StreamTelemetry = {};
  let fullContent = "";
  const legacyRequest: LegacyLLMRequest = {
    conversationId: args.conversationId,
    userId: args.userId,
    mode: args.mode,
    history: args.history,
    currentMessage: args.userText,
    telemetry,
  };
  for await (const chunk of args.backend.stream(legacyRequest)) {
    fullContent += chunk.delta;
    send({ type: "token", content: chunk.delta });
  }
  if (!fullContent.trim()) {
    throw new ProviderError("EMPTY_RESPONSE", "The provider returned an empty response.", { retryable: true });
  }
  const latencyMs = Date.now() - args.startedAt;
  const provider = telemetry.provider ?? head.provider;
  const model = telemetry.model ?? head.model;
  const tokenUsage = telemetry.usage;
  const nowIso = new Date().toISOString();
  await args.assistantRef.set({
    role: "assistant",
    content: fullContent,
    createdAt: FieldValue.serverTimestamp(),
    provider,
    model,
    latency: `${(latencyMs / 1000).toFixed(1)}s`,
    mode: args.mode,
    tokenUsage: tokenUsage ?? null,
    isImportant: false,
    error: false,
    metadata: { isMock: true, task, fallbackUsed: false, latencyMs },
  });
  await args.foundRef.update({
    updatedAt: FieldValue.serverTimestamp(),
    messageCount: FieldValue.increment(2),
    lastMessagePreview: fullContent.slice(0, 160),
  });
  const completeMsg: Message = {
    id: args.assistantMessageId,
    role: "assistant",
    content: fullContent,
    createdAt: nowIso,
    provider,
    model,
    latency: `${(latencyMs / 1000).toFixed(1)}s`,
    mode: args.mode,
    tokenUsage,
    metadata: { task, fallbackUsed: false },
  };
  send({
    type: "complete",
    messageId: args.assistantMessageId,
    message: completeMsg,
    usage: tokenUsage,
    provider,
    model,
    fallbackUsed: false,
  });
  void recordUsage(args.userId, {
    conversationId: args.conversationId,
    provider: "mock",
    model,
    task,
    mode: args.mode,
    promptTokens: tokenUsage?.promptTokens,
    completionTokens: tokenUsage?.completionTokens,
    totalTokens: tokenUsage?.totalTokens,
    fallbackUsed: false,
    latencyMs,
    createdAt: nowIso,
  });
}

interface LiveRun {
  backend: Extract<ReturnType<typeof import("@/lib/providers/index").getChatBackend>, { kind: "live" }>;
  userId: string;
  conversationId: string;
  mode: "auto" | "fast" | "balanced" | "reasoning";
  requestedModel?: string;
  requestedProvider?: "groq" | "gemini" | "openrouter" | "narorouter";
  llmMessages: LLMMessage[];
  assistantRef: FirebaseFirestore.DocumentReference;
  foundRef: FirebaseFirestore.DocumentReference;
  assistantMessageId: string;
  startedAt: number;
  signal: AbortSignal;
}

async function runLive(
  _controller: ReadableStreamDefaultController,
  send: (e: ChatStreamEvent) => void,
  args: LiveRun
) {
  const { registry, fallback } = args.backend;
  // Hot path: use cached health synchronously (never blocks first token);
  // refresh in the background for the NEXT request (module-level cache).
  const cached = registry.peekHealth();
  const health: Set<string> = new Set(
    cached.filter((r) => r.available).map((r) => r.provider)
  );
  void registry.refreshHealth();
  // Runtime provider config (admin overrides) refreshes in the background too.
  void refreshRuntimeConfig().catch(() => {});

  let decision;
  try {
    decision = await selectModel({
      messages: args.llmMessages,
      mode: args.mode,
      requestedModel: args.requestedModel,
      requestedProvider: args.requestedProvider,
      healthyProviders: health,
    });
  } catch (err) {
    if (err instanceof NoModelAvailableError) {
      const e = new Error(err.message) as Error & { code?: string };
      e.code = "NO_MODEL";
      throw e;
    }
    throw err;
  }

  const primaryLabel =
    registry.getProvider(decision.provider)?.displayName ?? decision.provider;
  send({
    type: "metadata",
    messageId: args.assistantMessageId,
    provider: primaryLabel,
    model: decision.model.displayName,
    mode: args.mode,
    task: decision.task,
    fallbackUsed: false,
    isMock: false,
  });

  const exec = fallback.stream(decision, args.llmMessages, args.signal);
  let fullContent = "";
  let usage: Message["tokenUsage"] | undefined;
  try {
    for await (const chunk of exec.stream) {
      if (chunk.content) {
        fullContent += chunk.content;
        send({ type: "token", content: chunk.content });
      }
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.promptTokens,
          completionTokens: chunk.usage.completionTokens,
          totalTokens: chunk.usage.totalTokens,
        };
      }
    }
  } catch (err) {
    // FallbackManager already tried the chain; surface the final error.
    try {
      await exec.done;
    } catch {
      // done rejects with the same error — fall through to outer handler.
    }
    throw err;
  }
  const result = await exec.done;
  if (!fullContent.trim()) {
    throw new ProviderError("EMPTY_RESPONSE", "The provider returned an empty response.", { retryable: true });
  }

  const latencyMs = Date.now() - args.startedAt;
  const finalLabel =
    registry.getProvider(result.metadata.finalProvider as ProviderId)?.displayName ??
    String(result.metadata.finalProvider);
  const finalModelId = result.metadata.finalModel;
  const finalModelInfo = registry.getModel(finalModelId);
  const latency = `${(latencyMs / 1000).toFixed(1)}s`;
  const nowIso = new Date().toISOString();
  const usageSrc = usage ?? result.usage;
  const tokenUsage = usageSrc
    ? {
        promptTokens: usageSrc.promptTokens,
        completionTokens: usageSrc.completionTokens,
        totalTokens: usageSrc.totalTokens,
      }
    : undefined;

  await args.assistantRef.set({
    role: "assistant",
    content: fullContent,
    createdAt: FieldValue.serverTimestamp(),
    provider: finalLabel,
    model: finalModelInfo?.displayName ?? finalModelId,
    latency,
    mode: args.mode,
    tokenUsage: tokenUsage ?? null,
    isImportant: false,
    error: false,
    metadata: {
      isMock: false,
      task: decision.task,
      fallbackUsed: result.metadata.fallbackUsed,
      attemptedModels: result.metadata.attemptedModels,
      latencyMs,
      manual: decision.manual,
    },
  });
  await args.foundRef.update({
    updatedAt: FieldValue.serverTimestamp(),
    messageCount: FieldValue.increment(2),
    lastMessagePreview: fullContent.slice(0, 160),
  });
  const completeMsg: Message = {
    id: args.assistantMessageId,
    role: "assistant",
    content: fullContent,
    createdAt: nowIso,
    provider: finalLabel,
    model: finalModelInfo?.displayName ?? finalModelId,
    latency,
    mode: args.mode,
    tokenUsage,
    metadata: { task: decision.task, fallbackUsed: result.metadata.fallbackUsed },
  };
  send({
    type: "complete",
    messageId: args.assistantMessageId,
    message: completeMsg,
    usage: tokenUsage,
    provider: finalLabel,
    model: finalModelInfo?.displayName ?? finalModelId,
    fallbackUsed: result.metadata.fallbackUsed,
  });
  void recordUsage(args.userId, {
    conversationId: args.conversationId,
    provider: result.metadata.finalProvider,
    model: finalModelId,
    task: decision.task,
    mode: args.mode,
    promptTokens: tokenUsage?.promptTokens,
    completionTokens: tokenUsage?.completionTokens,
    totalTokens: tokenUsage?.totalTokens,
    fallbackUsed: result.metadata.fallbackUsed,
    latencyMs,
    createdAt: nowIso,
  });
}
