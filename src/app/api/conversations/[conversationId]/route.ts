import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { badRequest, internalError, notFound, zodDetails } from "@/lib/server/errors";
import { serializeConversation, verifyConversationOwner } from "@/lib/server/conversations";
import {
  conversationIdSchema,
  updateConversationSchema,
} from "@/lib/validation/conversation-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth(req: NextRequest) {
  try {
    return { user: await requireAuthenticatedUser(req) };
  } catch (res) {
    if (res instanceof Response) return { response: res };
    console.error("[auth] unexpected error", res);
    return { response: internalError() };
  }
}

function badId() {
  return badRequest("Invalid conversation ID.");
}

export async function GET(req: NextRequest, { params }: { params: { conversationId: string } }) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  if (!conversationIdSchema.safeParse(params.conversationId).success) return badId();
  try {
    const found = await verifyConversationOwner(a.user.uid, params.conversationId);
    if (!found) return notFound("CONVERSATION_NOT_FOUND", "The requested conversation could not be found.");
    return Response.json({ conversation: serializeConversation(params.conversationId, found.data) });
  } catch (err) {
    console.error("[GET /api/conversations/:id]", err);
    return internalError();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { conversationId: string } }) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  if (!conversationIdSchema.safeParse(params.conversationId).success) return badId();
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = updateConversationSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update payload.", zodDetails(parsed.error.issues));
  try {
    const found = await verifyConversationOwner(a.user.uid, params.conversationId);
    if (!found) return notFound("CONVERSATION_NOT_FOUND", "The requested conversation could not be found.");
    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.pinned !== undefined) patch.pinned = parsed.data.pinned;
    if (parsed.data.archived !== undefined) patch.archived = parsed.data.archived;
    if (parsed.data.selectedMode !== undefined) patch.selectedMode = parsed.data.selectedMode;
    await found.ref.update(patch);
    const snap = await found.ref.get();
    return Response.json({ conversation: serializeConversation(params.conversationId, snap.data() ?? {}) });
  } catch (err) {
    console.error("[PATCH /api/conversations/:id]", err);
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { conversationId: string } }) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  if (!conversationIdSchema.safeParse(params.conversationId).success) return badId();
  try {
    const db = getAdminDb();
    const found = await verifyConversationOwner(a.user.uid, params.conversationId);
    if (!found) return notFound("CONVERSATION_NOT_FOUND", "The requested conversation could not be found.");
    // Delete subcollection messages in batches (simple approach for Phase 2 scale).
    const msgs = await found.ref.collection("messages").listDocuments();
    const batchSize = 400;
    for (let i = 0; i < msgs.length; i += batchSize) {
      const batch = db.batch();
      for (const doc of msgs.slice(i, i + batchSize)) batch.delete(doc);
      await batch.commit();
    }
    await found.ref.delete();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/conversations/:id]", err);
    return internalError();
  }
}
