import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/firestore";
import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { badRequest, internalError, notFound, zodDetails } from "@/lib/server/errors";
import { toISOString } from "@/lib/server/conversations";
import { updateSavedItemSchema } from "@/lib/validation/saved-item-schemas";

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

export async function PATCH(req: NextRequest, { params }: { params: { savedItemId: string } }) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = updateSavedItemSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid saved-item payload.", zodDetails(parsed.error.issues));
  try {
    const db = getAdminDb();
    const ref = db.doc(firestorePaths.savedItem(a.user.uid, params.savedItemId));
    const snap = await ref.get();
    if (!snap.exists) return notFound("SAVED_ITEM_NOT_FOUND", "Saved item not found.");
    await ref.update({ ...parsed.data });
    const updated = await ref.get();
    const v = updated.data() as Record<string, unknown>;
    return Response.json({
      item: {
        id: params.savedItemId,
        conversationId: v.conversationId,
        messageId: v.messageId,
        title: v.title,
        content: v.content,
        type: v.type,
        tags: v.tags ?? [],
        createdAt: toISOString(v.createdAt),
      },
    });
  } catch (err) {
    console.error("[PATCH saved-item]", err);
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { savedItemId: string } }) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  try {
    const db = getAdminDb();
    const ref = db.doc(firestorePaths.savedItem(a.user.uid, params.savedItemId));
    const snap = await ref.get();
    if (!snap.exists) return notFound("SAVED_ITEM_NOT_FOUND", "Saved item not found.");
    await ref.delete();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE saved-item]", err);
    return internalError();
  }
}
