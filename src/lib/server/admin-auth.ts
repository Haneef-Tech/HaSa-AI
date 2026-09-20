import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { unauthorized } from "./errors";

export const ADMIN_COOKIE = "hasa_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

interface AdminSession {
  email: string;
  exp: number;
}

function sessionSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET ?? "";
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not configured.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createAdminSession(email: string): { token: string; expiresAt: Date } {
  const session: AdminSession = { email, exp: Date.now() + SESSION_TTL_MS };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const expiresAt = new Date(session.exp);
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyAdminSession(token: string): AdminSession | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.email || typeof session.exp !== "number" || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Timing-safe admin credential check against server-only env vars. */
export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL ?? "";
  const expectedPass = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedEmail || !expectedPass) return false;
  const a = Buffer.from(email.trim().toLowerCase());
  const b = Buffer.from(expectedEmail.trim().toLowerCase());
  const c = Buffer.from(password);
  const d = Buffer.from(expectedPass);
  return (
    a.length === b.length &&
    c.length === d.length &&
    timingSafeEqual(a, b) &&
    timingSafeEqual(c, d)
  );
}

export function getAdminSessionFromCookies(): AdminSession | null {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSession(token);
}

export function requireAdminSession(): AdminSession {
  const session = getAdminSessionFromCookies();
  if (!session) throw unauthorized("Admin authentication required.");
  return session;
}
