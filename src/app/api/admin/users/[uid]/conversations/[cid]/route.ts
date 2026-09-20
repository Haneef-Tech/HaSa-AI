import { NextRequest } from "next/server";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { badRequest, internalError, notFound } from "@/lib/server/errors";
import { toISOString } from "@/lib/server/conversations";
import { deleteCollection } from "@/lib/server/admin-helpers";

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

const DEMO_TRANSCRIPT = {
  conversation: {
    id: "conv-rag-pipeline",
    title: "Building a RAG pipeline",
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    messageCount: 2,
  },
  messages: [
    {
      id: "msg_demo_1",
      role: "user",
      content: "How should I design an enterprise RAG pipeline that handles semantic vector search and keyword matching?",
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      provider: null,
      model: null,
    },
    {
      id: "msg_demo_2",
      role: "assistant",
      content: "To achieve high precision, combine dense vector retrieval (embeddings) with sparse lexical retrieval (BM25), followed by a cross-encoder reranker.",
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      provider: "HaSa Auto",
      model: "Smart selection preview",
    },
  ],
};

/** Read a user's conversation transcript (most recent 200 messages). */
export async function GET(
  _req: NextRequest,
  { params }: { params: { uid: string; cid: string } }
) {
  const g = guard();
  if (!g.ok) return g.response;
  if (!params.uid || !params.cid) return badRequest("Invalid IDs.");

  if (!isFirebaseAdminConfigured()) {
    return Response.json(DEMO_TRANSCRIPT);
  }

  try {
    const db = getAdminDb();
    if (!db) return Response.json(DEMO_TRANSCRIPT);

    const convRef = db.doc(`users/${params.uid}/conversations/${params.cid}`);
    const convSnap = await convRef.get();
    if (!convSnap.exists) return notFound("CONVERSATION_NOT_FOUND", "Conversation not found.");
    const msgs = await convRef.collection("messages").orderBy("createdAt", "asc").limit(200).get();
    const v = convSnap.data() as Record<string, unknown>;
    return Response.json({
      conversation: {
        id: params.cid,
        title: (v.title as string) ?? "Untitled",
        updatedAt: toISOString(v.updatedAt),
        messageCount: (v.messageCount as number) ?? 0,
      },
      messages: msgs.docs.map((d) => {
        const m = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          role: m.role,
          content: m.content,
          createdAt: toISOString(m.createdAt),
          provider: m.provider ?? null,
          model: m.model ?? null,
        };
      }),
    });
  } catch (err) {
    console.error("[GET admin conversation]", err);
    return Response.json(DEMO_TRANSCRIPT);
  }
}

/** Delete a single conversation and its messages. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { uid: string; cid: string } }
) {
  const g = guard();
  if (!g.ok) return g.response;
  if (!params.uid || !params.cid) return badRequest("Invalid IDs.");

  if (!isFirebaseAdminConfigured()) {
    return Response.json({ ok: true, cid: params.cid, demo: true });
  }

  try {
    const db = getAdminDb();
    if (!db) return Response.json({ ok: true, cid: params.cid });

    const convRef = db.doc(`users/${params.uid}/conversations/${params.cid}`);
    await deleteCollection(db, `${convRef.path}/messages`);
    await convRef.delete();
    return Response.json({ ok: true, cid: params.cid });
  } catch (err) {
    console.error("[DELETE admin conversation]", err);
    return internalError();
  }
}
