import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { UsageRecord } from "@/lib/usage/usage.types";

/**
 * Persists per-request usage under users/{userId}/usage/{usageId} and
 * maintains a lightweight aggregate on the user doc. Failures are logged,
 * never thrown — usage tracking must not break chat.
 */
export async function recordUsage(userId: string, record: UsageRecord): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection(`users/${userId}/usage`).add({
      ...record,
      createdAt: FieldValue.serverTimestamp(),
    });
    await db.doc(`users/${userId}`).set(
      {
        totalMessages: FieldValue.increment(1),
        totalTokens: FieldValue.increment(record.totalTokens ?? 0),
        lastUsedProvider: record.provider,
        lastActiveAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[usage] persist failed", err instanceof Error ? err.message : err);
  }
}
