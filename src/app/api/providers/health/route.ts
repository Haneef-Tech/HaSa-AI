import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { internalError } from "@/lib/server/errors";
import { getRegistry } from "@/lib/providers/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/providers/health — authenticated, cached (60s), sanitized.
 * Only availability + latency + checked-at; no keys, no raw diagnostics.
 */
export async function GET(req: Request) {
  try {
    await requireAuthenticatedUser(req);
  } catch (res) {
    if (res instanceof Response) return res;
    console.error("[auth] unexpected error", res);
    return internalError();
  }
  try {
    const providers = await getRegistry().checkHealth();
    return Response.json({
      providers: providers.map((p) => ({
        provider: p.provider,
        available: p.available,
        latencyMs: p.latencyMs,
        checkedAt: p.checkedAt,
        reason: p.reason,
      })),
    });
  } catch (err) {
    console.error("[GET /api/providers/health]", err instanceof Error ? err.message : err);
    return internalError();
  }
}
