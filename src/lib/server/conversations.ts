import "server-only";
import { FieldValue, type FirestoreDataConverter } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/firestore";
import type { Conversation } from "@/types/chat";

export function toISOString(value: unknown): string {
  try {
    const ts = value as { toDate?: () => Date } | undefined;
    if (ts && typeof ts.toDate === "function") return ts.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function serializeConversation(id: string, data: Record<string, unknown>): Conversation {
  const preview = (data.lastMessagePreview as string | undefined) ?? undefined;
  return {
    id,
    title: (data.title as string) ?? "New conversation",
    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt),
    selectedMode: (data.selectedMode as Conversation["selectedMode"]) ?? "auto",
    summary: (data.summary as string | undefined) ?? undefined,
    messageCount: (data.messageCount as number) ?? 0,
    lastMessagePreview: preview,
    lastMessageSnippet: preview,
    pinned: Boolean(data.pinned),
    archived: Boolean(data.archived),
  };
}

export function newConversationDoc(title: string, selectedMode: Conversation["selectedMode"]) {
  return {
    title,
    selectedMode,
    summary: null,
    messageCount: 0,
    lastMessagePreview: null,
    pinned: false,
    archived: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function verifyConversationOwner(userId: string, conversationId: string) {
  const db = getAdminDb();
  const ref = db.doc(firestorePaths.conversation(userId, conversationId));
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, data: snap.data() as Record<string, unknown> };
}

export const conversationConverter: FirestoreDataConverter<Record<string, unknown>> = {
  toFirestore: (v) => v,
  fromFirestore: (snap) => snap.data(),
};
