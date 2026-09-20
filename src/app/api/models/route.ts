import { requireAuthenticatedUser } from "@/lib/server/auth-middleware";
import { internalError } from "@/lib/server/errors";
import { getModelRegistry } from "@/lib/config/model-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/models — safe model metadata only. Never API keys, base URLs,
 * credentials, or raw provider payloads. Requires authentication.
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
    const models = getModelRegistry().map((m) => ({
      id: m.id,
      provider: m.provider,
      displayName: m.displayName,
      description: m.description,
      capabilities: m.capabilities,
      contextWindow: m.contextWindow,
      supportsStreaming: m.supportsStreaming,
      supportsVision: m.supportsVision ?? false,
      supportsJson: m.supportsJson ?? false,
      speed: m.speed,
      quality: m.quality,
      enabled: m.enabled,
    }));
    return Response.json({ models });
  } catch (err) {
    console.error("[GET /api/models]", err instanceof Error ? err.message : err);
    return internalError();
  }
}
