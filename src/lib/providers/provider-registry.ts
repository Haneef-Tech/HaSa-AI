import type {
  LLMProvider,
  ModelInfo,
  ProviderHealth,
  ProviderId,
} from "@/lib/providers/provider.types";
import { findModel, getAvailableModels, getModelRegistry } from "@/lib/config/model-config";

const HEALTH_TTL_MS = 60_000;

/**
 * ProviderRegistry (spec): registers only configured providers, serves model
 * metadata, and runs cached health checks. Never throws because one provider
 * is down; never exposes keys or raw error payloads.
 */
export class ProviderRegistry {
  private providers = new Map<ProviderId, LLMProvider>();
  private healthCache: { at: number; results: ProviderHealth[] } | null = null;

  register(provider: LLMProvider): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  getAvailableProviders(): LLMProvider[] {
    return [...this.providers.values()];
  }

  getProvider(providerId: ProviderId): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  getModel(modelId: string): ModelInfo | undefined {
    return findModel(modelId);
  }

  getAvailableModels(): ModelInfo[] {
    return getAvailableModels();
  }

  getAllModels(): ModelInfo[] {
    return getModelRegistry();
  }

  invalidateHealth(): void {
    this.healthCache = null;
  }

  /**
   * Hot-path accessor: returns the last known health SYNCHRONOUSLY
   * (empty on cold boot = "unknown", which carries no scoring penalty).
   * The chat route uses this so provider health can NEVER delay the
   * first token; call refreshHealth() alongside to update in background.
   */
  peekHealth(): ProviderHealth[] {
    return this.healthCache?.results ?? [];
  }

  /** Background refresh — never throws; updates the shared cache. */
  async refreshHealth(): Promise<ProviderHealth[]> {
    try {
      return await this.checkHealth(true);
    } catch {
      return this.peekHealth();
    }
  }

  async checkHealth(force = false): Promise<ProviderHealth[]> {
    const now = Date.now();
    if (!force && this.healthCache && now - this.healthCache.at < HEALTH_TTL_MS) {
      return this.healthCache.results;
    }
    const results = await Promise.all(
      [...this.providers.values()].map(async (p) => {
        try {
          return await p.healthCheck();
        } catch {
          return {
            provider: p.id,
            available: false,
            checkedAt: new Date().toISOString(),
            reason: "Health check failed.",
          } satisfies ProviderHealth;
        }
      })
    );
    this.healthCache = { at: now, results };
    return results;
  }
}
