import { ADMIN_COOKIE, requireAdminSession } from "@/lib/server/admin-auth";
import { internalError } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    requireAdminSession();
  } catch (res) {
    if (res instanceof Response) return res;
    return internalError();
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    `Set-Cookie`,
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return res;
}

export async function GET() {
  try {
    const session = requireAdminSession();
    return Response.json({ ok: true, email: session.email });
  } catch (res) {
    if (res instanceof Response) return res;
    return internalError();
  }
}
