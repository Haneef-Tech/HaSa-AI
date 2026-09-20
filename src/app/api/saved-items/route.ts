import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/firestore";
import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { badRequest, internalError, rateLimited, zodDetails } from "@/lib/server/errors";
import { getRateLimiter, RATE_LIMITS } from "@/lib/server/rate-limit";
import { toISOString } from "@/lib/server/conversations";
import { createSavedItemSchema } from "@/lib/validation/saved-item-schemas";
import type { SavedItem } from "@/types/chat";

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

function serialize(id: string, v: Record<string, unknown>): SavedItem {
  return {
    id,
    conversationId: (v.conversationId as string) ?? "",
    messageId: (v.messageId as string) ?? "",
    title: (v.title as string) ?? "",
    content: (v.content as string) ?? "",
    type: (v.type as SavedItem["type"]) ?? "note",
    tags: (v.tags as string[]) ?? [],
    createdAt: toISOString(v.createdAt),
  };
}

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  try {
    const db = getAdminDb();
    const snap = await db
      .collection(firestorePaths.savedItems(a.user.uid))
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return Response.json({ items: snap.docs.map((d) => serialize(d.id, d.data())) });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 5) {
      console.warn("[GET /api/saved-items] Firestore database not found — returning empty list.");
      return Response.json({ items: [] });
    }
    console.error("[GET /api/saved-items]", err);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  const limiter = getRateLimiter();
  const rl = await limiter.check(
    `saved-create:${a.user.uid}`,
    RATE_LIMITS.savedItemCreate.limit,
    RATE_LIMITS.savedItemCreate.windowMs
  );
  if (!rl.allowed) return rateLimited(rl.retryAfterMs);

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = createSavedItemSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid saved-item payload.", zodDetails(parsed.error.issues));

  try {
    const db = getAdminDb();
    // Verify referenced conversation/message belong to this user.
    const convDoc = await db.doc(firestorePaths.conversation(a.user.uid, parsed.data.conversationId)).get();
    if (!convDoc.exists) return badRequest("Referenced conversation does not exist or is not owned by you.");
    const msgDoc = await db
      .doc(firestorePaths.message(a.user.uid, parsed.data.conversationId, parsed.data.messageId))
      .get();
    if (!msgDoc.exists) return badRequest("Referenced message does not exist or is not owned by you.");

    const col = db.collection(firestorePaths.savedItems(a.user.uid));
    const ref = await col.add({
      ...parsed.data,
      createdAt: FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    return Response.json({ item: serialize(ref.id, snap.data() ?? {}) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/saved-items]", err);
    return internalError();
  }
}
