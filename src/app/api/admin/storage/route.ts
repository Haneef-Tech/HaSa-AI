import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { internalError } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BYTES_PER_MESSAGE = 1200;
const BYTES_PER_CONVERSATION = 512;
const BYTES_PER_SAVED_ITEM = 800;
const BYTES_PER_USAGE_RECORD = 300;

/** Quota override (bytes). Default = 1 GiB Spark free tier. */
function quotaBytes(): number {
  const raw = parseInt(process.env.FIREBASE_QUOTA_BYTES ?? "", 10);
  return Number.isFinite(raw) && (raw as number) > 0 ? (raw as number) : 1073741824;
}

const DEMO_STORAGE_TOTALS = {
  totals: { users: 3, conversations: 9, messages: 24, savedItems: 3, usageRecords: 24 },
  quota: { bytes: 1073741824, usedBytes: 36750, availableBytes: 1073741824 - 36750, plan: "Spark (free, default)" },
  collections: [
    { name: "messages", docs: 24, estimatedBytes: 28800 },
    { name: "conversations", docs: 9, estimatedBytes: 4608 },
    { name: "saved-items", docs: 3, estimatedBytes: 2400 },
    { name: "usage", docs: 24, estimatedBytes: 7200 },
  ],
  users: [
    {
      uid: "usr_demo_1",
      email: "aluruhaneef1@gmail.com",
      conversations: 4,
      messages: 12,
      savedItems: 2,
      estimatedBytes: 18450,
    },
    {
      uid: "usr_demo_2",
      email: "developer.team@hasa.ai",
      conversations: 3,
      messages: 8,
      savedItems: 1,
      estimatedBytes: 12200,
    },
    {
      uid: "usr_demo_3",
      email: "analyst@enterprise.com",
      conversations: 2,
      messages: 4,
      savedItems: 0,
      estimatedBytes: 6100,
    },
  ],
  note: "Preview storage stats. Add FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY to connect real Firestore.",
};

export async function GET() {
  try {
    requireAdminSession();
  } catch (res) {
    if (res instanceof Response) return res;
    return internalError();
  }

  if (!isFirebaseAdminConfigured()) {
    return Response.json(DEMO_STORAGE_TOTALS);
  }

  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    if (!auth || !db) {
      return Response.json(DEMO_STORAGE_TOTALS);
    }

    const users: Array<{
      uid: string;
      email: string | null;
      conversations: number;
      messages: number;
      savedItems: number;
      usageRecords: number;
      estimatedBytes: number;
    }> = [];
    let pageToken: string | undefined;
    let totalConversations = 0;
    let totalMessages = 0;
    let totalSavedItems = 0;
    let totalUsageRecords = 0;

    do {
      const page = await auth.listUsers(100, pageToken);
      for (const u of page.users) {
        const convsSnap = await db.collection(`users/${u.uid}/conversations`).get();
        let messages = 0;
        let bytes = 0;
        for (const c of convsSnap.docs) {
          const count = await c.ref.collection("messages").count().get();
          messages += count.data().count;
          const preview = (c.data().lastMessagePreview as string) ?? "";
          bytes += preview.length * 2 + BYTES_PER_CONVERSATION;
        }
        const savedSnap = await db.collection(`users/${u.uid}/saved-items`).count().get();
        const savedItems = savedSnap.data().count;
        const usageSnap = await db.collection(`users/${u.uid}/usage`).count().get();
        const usageRecords = usageSnap.data().count;
        bytes += messages * BYTES_PER_MESSAGE + savedItems * BYTES_PER_SAVED_ITEM + usageRecords * BYTES_PER_USAGE_RECORD;
        totalConversations += convsSnap.size;
        totalMessages += messages;
        totalSavedItems += savedItems;
        totalUsageRecords += usageRecords;
        users.push({
          uid: u.uid,
          email: u.email ?? null,
          conversations: convsSnap.size,
          messages,
          savedItems,
          usageRecords,
          estimatedBytes: bytes,
        });
      }
      pageToken = page.pageToken;
      if (users.length >= 500) break;
    } while (pageToken);

    users.sort((a, b) => b.estimatedBytes - a.estimatedBytes);
    const usedBytes = users.reduce((s, u) => s + u.estimatedBytes, 0);
    const quota = quotaBytes();
    return Response.json({
      totals: {
        users: users.length,
        conversations: totalConversations,
        messages: totalMessages,
        savedItems: totalSavedItems,
        usageRecords: totalUsageRecords,
      },
      quota: {
        bytes: quota,
        usedBytes,
        availableBytes: Math.max(quota - usedBytes, 0),
        plan: process.env.FIREBASE_QUOTA_BYTES ? "Custom (FIREBASE_QUOTA_BYTES)" : "Spark (free, default)",
      },
      collections: [
        { name: "messages", docs: totalMessages, estimatedBytes: totalMessages * BYTES_PER_MESSAGE },
        { name: "conversations", docs: totalConversations, estimatedBytes: totalConversations * BYTES_PER_CONVERSATION },
        { name: "saved-items", docs: totalSavedItems, estimatedBytes: totalSavedItems * BYTES_PER_SAVED_ITEM },
        { name: "usage", docs: totalUsageRecords, estimatedBytes: totalUsageRecords * BYTES_PER_USAGE_RECORD },
      ],
      users,
      note: "Byte figures are conservative estimates, not metered billing usage. Set FIREBASE_QUOTA_BYTES to match a paid plan.",
    });
  } catch (err) {
    console.error("[GET /api/admin/storage]", err);
    return Response.json(DEMO_STORAGE_TOTALS);
  }
}

/**
 * Purge a regenerable collection across all users. Only "usage" (derived
 * analytics) is allowed — conversations and messages can only be removed
 * per-user or per-conversation, never in bulk.
 */
export async function POST(req: Request) {
  try {
    requireAdminSession();
  } catch (res) {
    if (res instanceof Response) return res;
    return internalError();
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }
  if ((body as { collection?: string }).collection !== "usage") {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: 'Only the "usage" collection can be purged in bulk.' } },
      { status: 400 }
    );
  }
  if (!isFirebaseAdminConfigured()) {
    return Response.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Firebase Admin is not configured." } },
      { status: 503 }
    );
  }
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    if (!auth || !db) throw new Error("Admin backend unavailable.");
    let deleted = 0;
    let pageToken: string | undefined;
    let usersSeen = 0;
    do {
      const page = await auth.listUsers(100, pageToken);
      for (const u of page.users) {
        if (usersSeen++ >= 200) break;
        for (;;) {
          const snap = await db.collection(`users/${u.uid}/usage`).limit(300).get();
          if (snap.empty) break;
          const batch = db.batch();
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          deleted += snap.size;
          if (snap.size < 300) break;
        }
      }
      pageToken = page.pageToken;
    } while (pageToken && usersSeen < 200);
    return Response.json({ ok: true, deleted });
  } catch (err) {
    console.error("[POST /api/admin/storage/purge]", err);
    return internalError();
  }
}
