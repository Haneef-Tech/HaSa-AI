import { NextRequest } from "next/server";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { badRequest, internalError } from "@/lib/server/errors";
import { toISOString } from "@/lib/server/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_CONVERSATIONS = [
  {
    id: "conv-rag-pipeline",
    title: "Building a RAG pipeline",
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    selectedMode: "auto",
    messageCount: 4,
    lastMessagePreview: "Here is the production retrieval-augmented generation architecture...",
    pinned: true,
    archived: false,
  },
  {
    id: "conv-python-cleaning",
    title: "Python data-cleaning assistant",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    selectedMode: "fast",
    messageCount: 3,
    lastMessagePreview: "Use Polars or pandas with chunking to handle the 4GB CSV...",
    pinned: false,
    archived: false,
  },
];

function guard(): { ok: true } | { ok: false; response: Response } {
  try {
    requireAdminSession();
    return { ok: true };
  } catch (res) {
    if (res instanceof Response) return { ok: false, response: res };
    return { ok: false, response: internalError() };
  }
}

export async function GET(req: NextRequest, { params }: { params: { uid: string } }) {
  const g = guard();
  if (!g.ok) return g.response;
  if (!params.uid) return badRequest("Invalid user ID.");

  if (!isFirebaseAdminConfigured()) {
    return Response.json({ conversations: DEMO_CONVERSATIONS });
  }

  try {
    const db = getAdminDb();
    if (!db) return Response.json({ conversations: DEMO_CONVERSATIONS });

    const snap = await db
      .collection(`users/${params.uid}/conversations`)
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();
    return Response.json({
      conversations: snap.docs.map((d) => {
        const v = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          title: (v.title as string) ?? "Untitled",
          createdAt: toISOString(v.createdAt),
          updatedAt: toISOString(v.updatedAt),
          selectedMode: (v.selectedMode as string) ?? "auto",
          messageCount: (v.messageCount as number) ?? 0,
          lastMessagePreview: (v.lastMessagePreview as string) ?? null,
          pinned: Boolean(v.pinned),
          archived: Boolean(v.archived),
        };
      }),
    });
  } catch (err) {
    console.error("[GET admin user conversations]", err);
    return Response.json({ conversations: DEMO_CONVERSATIONS });
  }
}
