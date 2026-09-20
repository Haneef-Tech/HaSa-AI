import "server-only";
import type { Firestore } from "firebase-admin/firestore";

/** Best-effort recursive delete of a collection's documents in batches. */
export async function deleteCollection(
  db: Firestore,
  collectionPath: string,
  batchSize = 300
): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await db.collection(collectionPath).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      // Recurse into known subcollections first.
      if (collectionPath.includes("/conversations") && !collectionPath.includes("/messages")) {
        await deleteCollection(db, `${doc.ref.path}/messages`, batchSize);
      }
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return deleted;
}

/** Delete everything under users/{uid}: conversations(+messages), saved-items, preferences, doc. */
export async function deleteUserData(db: Firestore, uid: string): Promise<void> {
  await deleteCollection(db, `users/${uid}/conversations`);
  await deleteCollection(db, `users/${uid}/saved-items`);
  await db.doc(`users/${uid}/preferences/main`).delete().catch(() => {});
  await db.doc(`users/${uid}`).delete().catch(() => {});
}
