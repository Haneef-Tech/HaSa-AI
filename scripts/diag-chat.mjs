/**
 * End-to-end chat diagnostic (OPT-IN — touches real APIs + creates a test user).
 * Run:  npm run diag:chat -- [baseUrl] [mode] [provider]
 * Example: npm run diag:chat -- http://localhost:3000 fast groq
 *
 * Creates (once) a `diag-test@hasa.local` Firebase user via the Admin SDK,
 * mints an ID token, POSTs one tiny message to /api/chat, and reports:
 * time-to-first-token, total time, serving provider/model, fallback usage.
 * Prints shapes + timings only — never message content beyond its length.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}.`);
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const baseUrl = (process.argv[2] || "http://localhost:3000").replace("localhost", "127.0.0.1");
const mode = process.argv[3] || "fast";
const requestedProvider = process.argv[4] || undefined;

const { initializeApp, cert } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
});

const EMAIL = "diag-test@hasa.local";
let uid;
try {
  uid = (await getAuth().getUserByEmail(EMAIL)).uid;
} catch {
  uid = (await getAuth().createUser({ email: EMAIL, password: "DiagTest12345678!", emailVerified: true })).uid;
}
const customToken = await getAuth().createCustomToken(uid);
const verifyRes = await fetch(
  `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
);
const verifyJson = await verifyRes.json();
if (!verifyJson.idToken) throw new Error("token exchange failed: " + JSON.stringify(verifyJson).slice(0, 150));
const idToken = verifyJson.idToken;

// Ensure a conversation exists for the test user.
const db = getFirestore();
const convs = await db.collection(`users/${uid}/conversations`).limit(1).get();
let conversationId;
if (convs.empty) {
  const ref = await db.collection(`users/${uid}/conversations`).add({
    title: "diag",
    selectedMode: mode,
    messageCount: 0,
    pinned: false,
    archived: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  conversationId = ref.id;
} else {
  conversationId = convs.docs[0].id;
}

const t0 = Date.now();
const ctrl = new AbortController();
const hardTimeout = setTimeout(() => ctrl.abort(), 150_000);
let res;
try {
  res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ conversationId, message: "Reply with exactly: ok", mode, requestedProvider }),
    signal: ctrl.signal,
  });
} catch (err) {
  console.log(`FETCH-FAIL: ${(err && err.message) || err}`);
  process.exit(1);
} finally {
  clearTimeout(hardTimeout);
}
if (!res.ok || !res.body) {
  console.log(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let firstTokenAt = 0;
let chars = 0;
let meta = null;
let complete = null;
let errEvent = null;
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const frames = buffer.split("\n\n");
  buffer = frames.pop() ?? "";
  for (const frame of frames) {
    for (const line of frame.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const e = JSON.parse(raw);
        if (e.type === "metadata") meta = e;
        else if (e.type === "token") {
          if (!firstTokenAt) firstTokenAt = Date.now();
          chars += (e.content ?? "").length;
        } else if (e.type === "complete") complete = e;
        else if (e.type === "error") errEvent = e;
      } catch { /* ignore */ }
    }
  }
}
const total = Date.now() - t0;
console.log(`ttft=${firstTokenAt ? firstTokenAt - t0 : "n/a"}ms total=${total}ms chars=${chars}`);
console.log(`metadata=${JSON.stringify(meta)}`);
if (complete) console.log(`complete provider=${complete.provider} model=${complete.model} fallback=${complete.fallbackUsed} usage=${JSON.stringify(complete.usage)}`);
if (errEvent) console.log(`ERROR-EVENT=${JSON.stringify(errEvent)}`);
