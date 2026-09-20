import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/firestore";
import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { badRequest, internalError, zodDetails } from "@/lib/server/errors";
import { chatModeSchema } from "@/lib/validation/chat-schemas";
import { toISOString } from "@/lib/server/conversations";
import type { UserPreferences } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const preferencesSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).optional(),
  defaultMode: chatModeSchema.optional(),
});

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAuthenticatedUser(req);
  } catch (res) {
    if (res instanceof Response) return res;
    console.error("[auth] unexpected error", res);
    return internalError();
  }
  try {
    const db = getAdminDb();
    const snap = await db.doc(firestorePaths.preferences(user.uid)).get();
    const defaults: UserPreferences = { theme: "dark", defaultMode: "auto" };
    if (!snap.exists) return Response.json({ preferences: defaults });
    const v = snap.data() as Record<string, unknown>;
    return Response.json({
      preferences: {
        theme: (v.theme as UserPreferences["theme"]) ?? "dark",
        defaultMode: (v.defaultMode as UserPreferences["defaultMode"]) ?? "auto",
        updatedAt: v.updatedAt ? toISOString(v.updatedAt) : undefined,
      },
    });
  } catch (err) {
    console.error("[GET preferences]", err);
    return internalError();
  }
}

export async function PUT(req: NextRequest) {
  let user;
  try {
    user = await requireAuthenticatedUser(req);
  } catch (res) {
    if (res instanceof Response) return res;
    console.error("[auth] unexpected error", res);
    return internalError();
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid preferences payload.", zodDetails(parsed.error.issues));
  try {
    const db = getAdminDb();
    const ref = db.doc(firestorePaths.preferences(user.uid));
    await ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
    const snap = await ref.get();
    const v = (snap.data() ?? {}) as Record<string, unknown>;
    return Response.json({
      preferences: {
        theme: (v.theme as UserPreferences["theme"]) ?? "dark",
        defaultMode: (v.defaultMode as UserPreferences["defaultMode"]) ?? "auto",
        updatedAt: v.updatedAt ? toISOString(v.updatedAt) : undefined,
      },
    });
  } catch (err) {
    console.error("[PUT preferences]", err);
    return internalError();
  }
}
