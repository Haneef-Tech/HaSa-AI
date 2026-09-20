import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/firestore";
import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { badRequest, internalError, notFound } from "@/lib/server/errors";
import { toISOString, verifyConversationOwner } from "@/lib/server/conversations";
import { conversationIdSchema } from "@/lib/validation/conversation-schemas";
import type { Message } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { conversationId: string } }) {
  let user;
  try {
    user = await requireAuthenticatedUser(req);
  } catch (res) {
    if (res instanceof Response) return res;
    console.error("[auth] unexpected error", res);
    return internalError();
  }
  if (!conversationIdSchema.safeParse(params.conversationId).success) {
    return badRequest("Invalid conversation ID.");
  }
  try {
    const found = await verifyConversationOwner(user.uid, params.conversationId);
    if (!found) return notFound("CONVERSATION_NOT_FOUND", "The requested conversation could not be found.");

    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor"); // message doc id to start after
    const limit = Math.min(Math.max(parseInt(limitRaw ?? "100", 10) || 100, 1), 200);

    const db = getAdminDb();
    let query = db
      .collection(firestorePaths.messages(user.uid, params.conversationId))
      .orderBy("createdAt", "asc")
      .limit(limit);
    // Cursor pagination: start after the given message id (chronological order).
    if (cursor) {
      const cursorDoc = await db.doc(firestorePaths.message(user.uid, params.conversationId, cursor)).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }
    const snap = await query.get();
    const messages: Message[] = snap.docs.map((d) => {
      const v = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        role: (v.role as Message["role"]) ?? "user",
        content: (v.content as string) ?? "",
        createdAt: toISOString(v.createdAt),
        provider: (v.provider as string | undefined) ?? undefined,
        model: (v.model as string | undefined) ?? undefined,
        mode: (v.mode as Message["mode"]) ?? undefined,
        tokenUsage: (v.tokenUsage as Message["tokenUsage"]) ?? undefined,
        isImportant: Boolean(v.isImportant) || undefined,
        error: Boolean(v.error) || undefined,
        metadata: (v.metadata as Message["metadata"]) ?? undefined,
      };
    });
    return Response.json({ messages, nextCursor: snap.docs.length ? snap.docs[snap.docs.length - 1].id : null });
  } catch (err) {
    console.error("[GET messages]", err);
    return internalError();
  }
}
