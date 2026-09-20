"use client";

import { apiFetch } from "./client";
import type { ChatMode, Conversation } from "@/types/chat";

export async function listConversations(): Promise<Conversation[]> {
  const data = await apiFetch<{ conversations: Conversation[] }>("/api/conversations");
  return data.conversations;
}

export async function createConversation(input: { title?: string; selectedMode?: ChatMode } = {}) {
  const data = await apiFetch<{ conversation: Conversation }>("/api/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.conversation;
}

export async function updateConversation(
  id: string,
  patch: Partial<Pick<Conversation, "title" | "pinned" | "archived" | "selectedMode">>
) {
  const data = await apiFetch<{ conversation: Conversation }>(
    `/api/conversations/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  return data.conversation;
}

export async function deleteConversation(id: string) {
  await apiFetch<{ ok: boolean }>(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
