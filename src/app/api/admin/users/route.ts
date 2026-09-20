import { NextRequest } from "next/server";
import {
  getAdminAuth,
  getAdminDb,
  isFirebaseAdminConfigured,
  DEMO_ADMIN_USERS,
} from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { badRequest, internalError } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guard(): { ok: true } | { ok: false; response: Response } {
  try {
    requireAdminSession();
    return { ok: true };
  } catch (res) {
    if (res instanceof Response) return { ok: false, response: res };
    return { ok: false, response: internalError() };
  }
}

export async function GET(req: NextRequest) {
  const g = guard();
  if (!g.ok) return g.response;

  // If Firebase Admin is not yet configured, provide preview users safely
  if (!isFirebaseAdminConfigured()) {
    return Response.json({
      users: DEMO_ADMIN_USERS,
      nextPageToken: null,
      configured: false,
      notice:
        "Firebase Admin service account is not yet configured. Displaying demo users preview.",
    });
  }

  const url = new URL(req.url);
  const maxResults = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    200
  );
  const pageToken = url.searchParams.get("pageToken") || undefined;

  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    if (!auth || !db) {
      return Response.json({
        users: DEMO_ADMIN_USERS,
        nextPageToken: null,
        configured: false,
      });
    }

    const { users, pageToken: next } = await auth.listUsers(maxResults, pageToken);
    const items = await Promise.all(
      users.map(async (u) => {
        let conversations = 0;
        let savedItems = 0;
        try {
          const [c, s] = await Promise.all([
            db.collection(`users/${u.uid}/conversations`).count().get(),
            db.collection(`users/${u.uid}/saved-items`).count().get(),
          ]);
          conversations = c.data().count;
          savedItems = s.data().count;
        } catch {
          // Firestore may be unreachable — still return the auth record.
        }
        return {
          uid: u.uid,
          email: u.email ?? null,
          disabled: u.disabled,
          createdAt: u.metadata.creationTime,
          lastSignIn: u.metadata.lastSignInTime ?? null,
          conversations,
          savedItems,
        };
      })
    );
    return Response.json({ users: items, nextPageToken: next ?? null, configured: true });
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    // Fallback to demo users instead of 500 error
    return Response.json({
      users: DEMO_ADMIN_USERS,
      nextPageToken: null,
      configured: false,
      error: "Could not connect to Firebase Admin Auth API. Displaying demo users preview.",
    });
  }
}

export async function DELETE(req: NextRequest) {
  return badRequest("Use DELETE /api/admin/users/:uid.");
}
