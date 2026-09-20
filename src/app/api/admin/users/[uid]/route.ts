import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { badRequest, internalError, notFound } from "@/lib/server/errors";
import { deleteUserData } from "@/lib/server/admin-helpers";

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

/** Irreversibly delete a user: Firestore data first, Auth record last. */
export async function DELETE(_req: NextRequest, { params }: { params: { uid: string } }) {
  const g = guard();
  if (!g.ok) return g.response;
  const uid = params.uid;
  if (!uid || uid.length > 128) return badRequest("Invalid user ID.");

  if (!isFirebaseAdminConfigured()) {
    return Response.json({ ok: true, uid, demo: true });
  }

  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    if (!auth || !db) {
      return Response.json({ ok: true, uid, demo: true });
    }

    try {
      await auth.getUser(uid);
    } catch {
      return notFound("NOT_FOUND", "User not found.");
    }
    await deleteUserData(db, uid);
    await auth.deleteUser(uid);
    return Response.json({ ok: true, uid });
  } catch (err) {
    console.error("[DELETE /api/admin/users/:uid]", err);
    return internalError();
  }
}
