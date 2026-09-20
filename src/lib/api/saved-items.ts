"use client";

import { apiFetch } from "./client";
import type { SavedItem, SavedItemType } from "@/types/chat";

export async function listSavedItems(): Promise<SavedItem[]> {
  const data = await apiFetch<{ items: SavedItem[] }>("/api/saved-items");
  return data.items;
}

export async function createSavedItem(input: {
  conversationId: string;
  messageId: string;
  title: string;
  content: string;
  type: SavedItemType;
  tags?: string[];
}) {
  const data = await apiFetch<{ item: SavedItem }>("/api/saved-items", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.item;
}

export async function deleteSavedItem(id: string) {
  await apiFetch<{ ok: boolean }>(`/api/saved-items/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
