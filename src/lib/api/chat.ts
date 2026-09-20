"use client";

import { getIdToken } from "@/lib/firebase/auth";
import { apiErrorFromResponse } from "./client";
import type { ChatMode, ChatStreamEvent } from "@/types/chat";

export interface StreamError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  status?: number;
}

export interface StreamCallbacks {
  onMetadata?: (e: Extract<ChatStreamEvent, { type: "metadata" }>) => void;
  onToken?: (delta: string, accumulated: string) => void;
  onComplete?: (e: Extract<ChatStreamEvent, { type: "complete" }>) => void;
  onError?: (err: StreamError) => void;
}

/** Friendly client-side mapping for stream/API error codes. */
function friendlyStreamError(raw: {
  code?: string;
  message?: string;
  retryable?: boolean;
  retryAfterMs?: number;
  status?: number;
}): StreamError {
  const code = raw.code ?? "UNKNOWN";
  const retryable = raw.retryable ?? true;
  const map: Record<string, string> = {
    NO_MODEL: "No AI model is available right now. Please try again later.",
    RATE_LIMITED: "HaSa AI is handling many requests. Please wait a moment and retry.",
    CONFLICT: "A response is already being generated. Retrying…",
  };
  return {
    code,
    message: map[code] ?? raw.message ?? "Something went wrong. Please retry.",
    retryable,
    ...(raw.retryAfterMs !== undefined ? { retryAfterMs: raw.retryAfterMs } : {}),
    ...(raw.status !== undefined ? { status: raw.status } : {}),
  };
}

/**
 * POST /api/chat and parse the SSE stream. Returns an AbortController
 * so the UI Stop button can cancel generation.
 */
export async function streamChat(
  input: { conversationId: string; message: string; mode?: ChatMode; requestedModel?: string; requestedProvider?: string },
  cb: StreamCallbacks,
  externalSignal?: AbortSignal
): Promise<{ abort: () => void }> {
  const token = await getIdToken().catch(() => null);
  if (!token) {
    cb.onError?.({ code: "UNAUTHORIZED", message: "You are not signed in.", retryable: false });
    return { abort: () => {} };
  }
  const controller = new AbortController();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: controller.signal,
  }).catch((err) => {
    if ((err as Error)?.name === "AbortError") return null;
    throw err;
  });
  if (res === null) return { abort: () => controller.abort() }; // aborted before start
  if (!res.ok || !res.body) {
    const apiErr = await apiErrorFromResponse(res);
    cb.onError?.(
      friendlyStreamError({
        code: apiErr.code,
        message: apiErr.message,
        retryAfterMs: apiErr.retryAfterMs,
        status: apiErr.status,
      })
    );
    return { abort: () => controller.abort() };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  const processEvent = (raw: string) => {
    const line = raw.trim();
    if (!line || line === "[DONE]") return;
    try {
      const event = JSON.parse(line) as ChatStreamEvent;
      if (event.type === "metadata") cb.onMetadata?.(event);
      else if (event.type === "token") {
        accumulated += event.content;
        cb.onToken?.(event.content, accumulated);
      } else if (event.type === "complete") cb.onComplete?.(event);
      else if (event.type === "error")
        cb.onError?.(friendlyStreamError({ code: event.code, message: event.message, retryable: event.retryable }));
    } catch {
      // Ignore malformed SSE lines.
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by blank lines.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const lines = frame.split("\n").filter((l) => l.startsWith("data:"));
        for (const l of lines) processEvent(l.slice(5));
      }
    }
    if (buffer.trim()) {
      const lines = buffer.split("\n").filter((l) => l.startsWith("data:"));
      for (const l of lines) processEvent(l.slice(5));
    }
  } catch (err) {
    if ((err as Error)?.name !== "AbortError")
      cb.onError?.({ code: "STREAM_INTERRUPTED", message: "Streaming was interrupted. Please retry.", retryable: true });
  } finally {
    reader.releaseLock();
  }
  return { abort: () => controller.abort() };
}
