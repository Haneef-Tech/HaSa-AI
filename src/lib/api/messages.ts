"use client";

import { apiFetch } from "./client";
import type { Message } from "@/types/chat";

export async function listMessages(
  conversationId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<{ messages: Message[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages${qs}`);
}
