export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

type Bucket = { count: number; resetAt: number };

/**
 * In-memory token-bucket-ish rate limiter for single-instance dev.
 * NOT suitable for multi-instance production — use Redis (e.g. Upstash)
 * with atomic INCR + EXPIRE behind this same interface.
 */
class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }
    if (existing.count < limit) {
      existing.count += 1;
      return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
    }
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, existing.resetAt - now) };
  }
}

// Singleton per serverless-instance; fine for dev.
let singleton: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!singleton) singleton = new InMemoryRateLimiter();
  return singleton;
}

export const RATE_LIMITS = {
  chat: { limit: 20, windowMs: 60_000 },
  conversationCreate: { limit: 30, windowMs: 60_000 },
  savedItemCreate: { limit: 30, windowMs: 60_000 },
} as const;
