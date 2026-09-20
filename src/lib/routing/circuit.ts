/**
 * Minimal 429 circuit breaker (in-memory, per instance).
 * When a model is rate-limited, skip it briefly so follow-up requests don't
 * pay another failing round-trip (and don't burn more quota). Best-effort:
 * multi-instance deployments coordinate loosely; worst case a request tries
 * a cooling model once and fails over normally.
 */

const COOLDOWN_MS = 5 * 60_000;
const tripped = new Map<string, number>();

export function noteRateLimited(modelId: string): void {
  tripped.set(modelId, Date.now());
}

export function isCoolingDown(modelId: string): boolean {
  const at = tripped.get(modelId);
  if (at === undefined) return false;
  if (Date.now() - at > COOLDOWN_MS) {
    tripped.delete(modelId);
    return false;
  }
  return true;
}

/** Test hook. */
export function resetCircuit(): void {
  tripped.clear();
}
