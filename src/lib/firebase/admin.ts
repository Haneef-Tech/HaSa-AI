import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

const DEFAULT_PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || "hasa-25ec7";

/**
 * Returns true only if valid Firebase Admin service account credentials are provided.
 */
export function isFirebaseAdminConfigured(): boolean {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  return Boolean(
    projectId &&
    projectId.trim() !== "" &&
    clientEmail &&
    clientEmail.trim() !== "" &&
    privateKey &&
    privateKey.trim() !== ""
  );
}

export function getAdminApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

  const projectId = DEFAULT_PROJECT_ID;

  if (isFirebaseAdminConfigured()) {
    try {
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
      const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!;
      const privateKey = rawKey.replace(/\\n/g, "\n");

      app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
      return app;
    } catch (err) {
      console.warn("[firebase-admin] Error initializing with cert, falling back to projectId:", err);
    }
  }

  // Graceful fallback for local development: initialize with projectId
  app = initializeApp({ projectId });
  return app;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) adminAuth = getAuth(getAdminApp());
  return adminAuth;
}

export function getAdminDb(): Firestore {
  if (!adminDb) adminDb = getFirestore(getAdminApp());
  return adminDb;
}

// Fallback preview data for admin dashboard when service account is not yet configured
export const DEMO_ADMIN_USERS = [
  {
    uid: "usr_demo_1",
    email: "aluruhaneef1@gmail.com",
    disabled: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    lastSignIn: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    conversations: 4,
    savedItems: 2,
  },
  {
    uid: "usr_demo_2",
    email: "developer.team@hasa.ai",
    disabled: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    lastSignIn: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    conversations: 3,
    savedItems: 1,
  },
  {
    uid: "usr_demo_3",
    email: "analyst@enterprise.com",
    disabled: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    lastSignIn: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    conversations: 2,
    savedItems: 0,
  },
];
