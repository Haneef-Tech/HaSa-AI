import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/firestore";
import { MAX_CONTEXT_MESSAGES } from "@/lib/validation/chat-schemas";
import type { Message } from "@/types/chat";

export interface ContextPayload {
  conversationId: string;
  /** Chronological (oldest → newest), capped at MAX_CONTEXT_MESSAGES. */
  history: Pick<Message, "id" | "role" | "content" | "createdAt">[];
  currentMessage: string;
  /** Reserved for Phase 3: rolling summary to compress long histories. */
  summaryPlaceholder: string | null;
}

/**
 * Load the latest messages for a conversation and build an LLM-ready
 * context payload. Throws NOT_FOUND-style errors via `code` property.
 */
export async function buildConversationContext(
  userId: string,
  conversationId: string,
  currentMessage: string,
  maxMessages: number = MAX_CONTEXT_MESSAGES
): Promise<ContextPayload> {
  const db = getAdminDb();
  const convRef = db.doc(firestorePaths.conversation(userId, conversationId));
  const convSnap = await convRef.get();
  if (!convSnap.exists) {
    const err = new Error("Conversation not found.") as Error & { code?: string };
    err.code = "CONVERSATION_NOT_FOUND";
    throw err;
  }

  const msgsRef = db.collection(firestorePaths.messages(userId, conversationId));
  const snap = await msgsRef.orderBy("createdAt", "desc").limit(maxMessages).get();
  const docs = snap.docs.reverse().map((d) => {
    const data = d.data() as { role: Message["role"]; content: string; createdAt?: unknown };
    let createdAt = "";
    try {
      const ts = data.createdAt as { toDate?: () => Date } | undefined;
      createdAt = ts?.toDate ? ts.toDate().toISOString() : String(data.createdAt ?? "");
    } catch {
      createdAt = "";
    }
    return { id: d.id, role: data.role, content: data.content, createdAt };
  });

  // TODO(Phase 3): when history exceeds token budget, summarize oldest
  // messages into `summary` and store it on the conversation document.
  return {
    conversationId,
    history: docs,
    currentMessage,
    summaryPlaceholder: null,
  };
}
