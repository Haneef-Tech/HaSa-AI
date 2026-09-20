import { NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, createAdminSession, verifyAdminCredentials } from "@/lib/server/admin-auth";
import { badRequest, internalError, rateLimited } from "@/lib/server/errors";
import { getRateLimiter } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const limiter = getRateLimiter();
  const rl = await limiter.check(`admin-login:${ip}`, 10, 10 * 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterMs);

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return badRequest("Email and password are required.");

  try {
    if (!verifyAdminCredentials(parsed.data.email, parsed.data.password)) {
      // Generic message — never reveal whether the email or password was wrong.
      return badRequest("Invalid email or password.");
    }
    const { token, expiresAt } = createAdminSession(parsed.data.email.trim().toLowerCase());
    const res = Response.json({ ok: true, email: parsed.data.email.trim().toLowerCase() });
    res.headers.append(
      "Set-Cookie",
      `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
        (expiresAt.getTime() - Date.now()) / 1000
      )}; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}`
    );
    return res;
  } catch (err) {
    console.error("[POST /api/admin/login]", err);
    return internalError();
  }
}
