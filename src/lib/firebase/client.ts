import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Fallback configuration from project hasa-25ec7 ensures zero runtime errors
// if env variables are not passed through Webpack DefinePlugin in browser
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC_MHQteALHdk0lKx9FEsY-dgokLSzBDp4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hasa-25ec7.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hasa-25ec7",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "hasa-25ec7.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "31103085369",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:31103085369:web:fb04170474ea089a8dd6e8",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-BDT325CJWG",
};

let app: FirebaseApp | null = null;

export function getFirebaseClientApp(): FirebaseApp {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApp();
    return app;
  }
  if (!firebaseConfig.apiKey) {
    throw new Error(
      "Missing required client env var: NEXT_PUBLIC_FIREBASE_API_KEY. Copy .env.example to .env.local and fill it in."
    );
  }
  app = initializeApp(firebaseConfig);
  return app;
}

let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseClientApp());
  return auth;
}

export function getClientDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseClientApp());
  return db;
}

let analyticsInit = false;
let analyticsWarned = false;

/**
 * Initialize Firebase Analytics (browser only, optional).
 * No-op on the server or when measurementId is unset or unsupported.
 */
export async function initFirebaseAnalytics(): Promise<void> {
  if (typeof window === "undefined" || analyticsInit) return;
  const measurementId = firebaseConfig.measurementId;
  if (!measurementId) return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    const supported = await isSupported();
    if (supported) {
      getAnalytics(getFirebaseClientApp());
      analyticsInit = true;
    }
  } catch (err) {
    // Analytics must never break the app (e.g. ad-blockers, offline, private browsing).
    if (!analyticsWarned) {
      analyticsWarned = true;
      console.warn(
        "[firebase] analytics init skipped:",
        err instanceof Error ? err.message : err
      );
    }
  }
}
