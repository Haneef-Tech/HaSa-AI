export type ErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONVERSATION_NOT_FOUND"
  | "MESSAGE_NOT_FOUND"
  | "SAVED_ITEM_NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryAfterMs?: number;
    details?: unknown;
  };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  extra?: { retryAfterMs?: number; details?: unknown; headers?: Record<string, string> }
): Response {
  const body: ApiErrorBody = {
    error: { code, message, ...(extra?.retryAfterMs !== undefined ? { retryAfterMs: extra.retryAfterMs } : {}), ...(extra?.details !== undefined ? { details: extra.details } : {}) },
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra?.headers ?? {}),
  };
  if (extra?.retryAfterMs !== undefined) {
    headers["Retry-After"] = String(Math.ceil(extra.retryAfterMs / 1000));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function badRequest(message = "Invalid request.", details?: unknown) {
  return errorResponse("INVALID_INPUT", message, 400, { details });
}

export function unauthorized(message = "Authentication required.") {
  return errorResponse("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "You do not have access to this resource.") {
  return errorResponse("FORBIDDEN", message, 403);
}

export function notFound(code: ErrorCode = "NOT_FOUND", message = "Resource not found.") {
  return errorResponse(code, message, 404);
}

export function rateLimited(retryAfterMs: number) {
  return errorResponse("RATE_LIMITED", "Rate limit exceeded. Please retry shortly.", 429, {
    retryAfterMs,
  });
}

export function internalError(message = "An unexpected error occurred.") {
  // Never include stack traces here; log them server-side instead.
  return errorResponse("INTERNAL_ERROR", message, 500);
}

export function zodDetails(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
}
