"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Sparkles, Cpu, Check, Ban } from "lucide-react";
import type { ApiModel } from "@/lib/api/models";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  models: ApiModel[];
  /** Model ID, or null for automatic routing. */
  value: string | null;
  onSelect: (modelId: string | null) => void;
  className?: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  groq: "Groq",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  narorouter: "NaroRouter",
};

const SPEED_DOT: Record<string, string> = {
  fast: "bg-emerald-400",
  medium: "bg-amber-400",
  slow: "bg-rose-400",
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  value,
  onSelect,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const enabled = models.filter((m) => m.enabled);
  const disabled = models.filter((m) => !m.enabled);
  const selected = value ? models.find((m) => m.id === value) : null;

  const label = selected ? selected.displayName : "Auto";
  const sub = selected
    ? PROVIDER_LABEL[selected.provider] ?? selected.provider
    : enabled.length > 0
      ? `${enabled.length} model${enabled.length > 1 ? "s" : ""} · router picks`
      : "No models configured";

  return (
    <div ref={dropdownRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border/80 hover:bg-surface-elevated hover:border-violet-500/40 text-xs font-medium text-foreground transition-all focus-ring select-none max-w-[220px]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select model. Current: ${label}`}
      >
        {selected ? <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> : <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
        <span className="truncate">{label}</span>
        <span className="hidden sm:inline text-[10px] text-muted-foreground truncate">· {sub}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5 shrink-0" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute top-full right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-y-auto p-1.5 bg-surface-elevated border border-border rounded-xl shadow-2xl z-50 text-xs animate-in fade-in-0 zoom-in-95 duration-200"
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60 mb-1">
            Model selection
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); setIsOpen(false); }}
            role="option"
            aria-selected={value === null}
            className={cn(
              "flex items-start gap-2.5 w-full p-2 rounded-lg text-left transition-colors",
              value === null
                ? "bg-accent/15 border border-accent/30 text-foreground"
                : "hover:bg-surface-hover text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">Auto (recommended)</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                HaSa analyzes your task and routes to the best configured model with fallback.
              </div>
            </div>
            {value === null && <Check className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />}
          </button>

          {enabled.length > 0 && (
            <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Manual
            </div>
          )}
          {enabled.map((m) => {
            const isSelected = value === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { onSelect(m.id); setIsOpen(false); }}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "flex items-start gap-2.5 w-full p-2 rounded-lg text-left transition-colors",
                  isSelected
                    ? "bg-accent/15 border border-accent/30 text-foreground"
                    : "hover:bg-surface-hover text-muted-foreground hover:text-foreground"
                )}
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">{m.displayName}</span>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", SPEED_DOT[m.speed])} title={`Speed: ${m.speed}`} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{m.description}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <span className="text-[10px] font-mono text-slate-400">{PROVIDER_LABEL[m.provider] ?? m.provider}</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] font-mono text-slate-400">{m.quality}</span>
                    {m.capabilities.slice(0, 3).map((c) => (
                      <span key={c} className="text-[10px] px-1.5 py-px rounded bg-violet-500/10 text-violet-300">{c}</span>
                    ))}
                  </div>
                  <div className="text-[10px] font-mono text-slate-600 mt-0.5 truncate" title={m.id}>{m.id}</div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />}
              </button>
            );
          })}

          {disabled.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Unavailable
              </div>
              {disabled.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-2.5 w-full p-2 rounded-lg text-left opacity-50 cursor-not-allowed"
                  title="Not configured on the server"
                >
                  <Ban className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-muted-foreground">{m.displayName}</span>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Not configured — contact your administrator.</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
