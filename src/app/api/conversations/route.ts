import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/firestore";
import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { badRequest, forbidden, internalError, notFound, rateLimited, unauthorized } from "@/lib/server/errors";
import { getRateLimiter, RATE_LIMITS } from "@/lib/server/rate-limit";
import { newConversationDoc, serializeConversation } from "@/lib/server/conversations";
import { createConversationSchema } from "@/lib/validation/conversation-schemas";
import { zodDetails } from "@/lib/server/errors";

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

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  try {
    const db = getAdminDb();
    const snap = await db
      .collection(firestorePaths.conversations(a.user.uid))
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();
    const conversations = snap.docs.map((d) => serializeConversation(d.id, d.data()));
    return Response.json({ conversations });
  } catch (err: unknown) {
    // gRPC code 5 = NOT_FOUND: Firestore database not yet created in Firebase Console.
    // Return empty list so the UI stays functional while the DB is being provisioned.
    const code = (err as { code?: number })?.code;
    if (code === 5) {
      console.warn("[GET /api/conversations] Firestore database not found — returning empty list. Enable Firestore in Firebase Console.");
      return Response.json({ conversations: [] });
    }
    console.error("[GET /api/conversations]", err);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const a = await auth(req);
  if ("response" in a) return a.response;
  try {
    const limiter = getRateLimiter();
    const rl = await limiter.check(
      `conv-create:${a.user.uid}`,
      RATE_LIMITS.conversationCreate.limit,
      RATE_LIMITS.conversationCreate.windowMs
    );
    if (!rl.allowed) return rateLimited(rl.retryAfterMs);

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid conversation payload.", zodDetails(parsed.error.issues));
    }
    const db = getAdminDb();
    const col = db.collection(firestorePaths.conversations(a.user.uid));
    const doc = await col.add(newConversationDoc(parsed.data.title, parsed.data.selectedMode));
    const snap = await doc.get();
    return Response.json(
      { conversation: serializeConversation(doc.id, snap.data() ?? {}) },
      { status: 201 }
    );
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 5) {
      return Response.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Firestore database not yet created. Enable it in Firebase Console → Firestore Database." } },
        { status: 503 }
      );
    }
    console.error("[POST /api/conversations]", err);
    return internalError();
  }
}
