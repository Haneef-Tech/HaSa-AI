import "server-only";
import { getAdminAuth } from "@/lib/firebase/admin";
import { unauthorized } from "./errors";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
}

/**
 * Verify `Authorization: Bearer <Firebase ID token>` and return safe user info.
 * NEVER trust a client-submitted userId — always derive it from the token.
 */
export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedUser> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    throw unauthorized("Missing Authorization Bearer token.");
  }
  const token = header.slice("bearer ".length).trim();
  if (!token) throw unauthorized("Missing Authorization Bearer token.");
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: (decoded.name as string | undefined) ?? decoded.email ?? undefined,
    };
  } catch (err) {
    // Log server-side for ops debugging; client only gets a generic 401.
    console.error("[auth] token verification failed", err instanceof Error ? err.message : err);
    throw unauthorized("Invalid or expired authentication token.");
  }
}

/** Helper for route handlers: run auth and return a 401 Response on failure. */
export async function authenticateRequest(
  request: Request
): Promise<{ user: AuthenticatedUser } | { response: Response }> {
  try {
    const user = await requireAuthenticatedUser(request);
    return { user };
  } catch (err) {
    if (err instanceof Response) return { response: err };
    // Our error helpers throw Responses via `throw unauthorized(...)`? No — they return.
    // requireAuthenticatedUser throws the Response object directly.
    return { response: err as Response };
  }
}
