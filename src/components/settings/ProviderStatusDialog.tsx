"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, X, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { fetchModels, fetchProviderHealth, type ApiModel, type ProviderStatus } from "@/lib/api/models";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<string, string> = {
  groq: "Groq",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  narorouter: "NaroRouter",
};

/** Developer panel: configured providers, health, latency, enabled models. No secrets. */
export function ProviderStatusDialog({ onClose }: { onClose: () => void }) {
  const [models, setModels] = useState<ApiModel[] | null>(null);
  const [health, setHealth] = useState<ProviderStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [m, h] = await Promise.all([fetchModels(), fetchProviderHealth()]);
      setModels(m);
      setHealth(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load provider status.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const healthByProvider = new Map((health ?? []).map((h) => [h.provider, h]));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-surface-elevated shadow-2xl"
        role="dialog"
        aria-label="Provider status"
      >
        <div className="sticky top-0 flex items-center gap-2 p-4 border-b border-border bg-surface-elevated/95 backdrop-blur">
          <Activity className="w-4 h-4 text-accent-light" />
          <h2 className="text-sm font-semibold flex-1">Providers & models</h2>
          <button
            onClick={() => void load()}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            aria-label="Refresh status"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2.5 text-xs text-rose-200">{error}</div>
          )}
          {(!models || !health) && !error ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {(health ?? []).map((h) => (
                  <div key={h.provider} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-3">
                    {h.available ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{PROVIDER_LABEL[h.provider] ?? h.provider}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {h.available
                          ? `Available${h.latencyMs !== undefined ? ` · ~${(h.latencyMs / 1000).toFixed(1)}s check` : ""}`
                          : h.reason ?? "Unavailable"}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {h.checkedAt ? new Date(h.checkedAt).toLocaleTimeString() : ""}
                    </span>
                  </div>
                ))}
                {(health ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No providers configured — the app is running in mock mode.</p>
                )}
              </div>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Enabled models ({(models ?? []).filter((m) => m.enabled).length})
                </h3>
                <div className="space-y-1.5">
                  {(models ?? []).filter((m) => m.enabled).map((m) => (
                    <div key={m.id} className="rounded-xl border border-border bg-surface px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate">{m.displayName}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{PROVIDER_LABEL[m.provider] ?? m.provider}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{m.id}</div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Automatic routing picks the best enabled model per task with fallback.
                Choose a model manually to override it. Server keys are never exposed here.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ProviderStatusButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border/80 hover:bg-surface-elevated hover:border-violet-500/40 text-xs font-medium text-muted-foreground hover:text-foreground transition-all focus-ring",
          className
        )}
        aria-label="Open provider status"
      >
        <Activity className="w-3.5 h-3.5 shrink-0" />
        <span>Providers</span>
      </button>
      <AnimatePresence>{open && <ProviderStatusDialog onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}
