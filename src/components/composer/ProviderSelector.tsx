"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronUp, Zap, Scale, Brain, Layers, Check } from "lucide-react";
import type { ProviderId } from "@/lib/providers/provider.types";
import { cn } from "@/lib/utils";

export type ProviderChoice = ProviderId;

interface ProviderSelectorProps {
  value: ProviderChoice;
  onSelect: (provider: ProviderChoice) => void;
  className?: string;
}

const PROVIDERS: Array<{
  id: ProviderChoice;
  name: string;
  tagline: string;
  badge: string;
  icon: React.ReactNode;
}> = [
  {
    id: "groq",
    name: "Groq",
    tagline: "Lightning-fast answers",
    badge: "Fastest",
    icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    id: "gemini",
    name: "Gemini",
    tagline: "Balanced reasoning, huge context",
    badge: "Versatile",
    icon: <Scale className="w-3.5 h-3.5 text-cyan-400" />,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "Deep reasoning pool",
    badge: "Smartest",
    icon: <Brain className="w-3.5 h-3.5 text-emerald-400" />,
  },
  {
    id: "narorouter",
    name: "NaroRouter",
    tagline: "Cost-efficient gateway",
    badge: "Saver",
    icon: <Layers className="w-3.5 h-3.5 text-violet-400" />,
  },
];

/**
 * Provider-only picker for the composer. Users choose one of the four
 * providers — never raw model IDs. Opens upward to fit above the keyboard.
 */
export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  value,
  onSelect,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const active = PROVIDERS.find((p) => p.id === value) ?? PROVIDERS[0];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <div ref={dropdownRef} className={cn("relative inline-block shrink-0", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 pl-2 pr-1.5 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring select-none"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select AI provider. Current: ${active.name}`}
        title={`Provider: ${active.name} — ${active.tagline}`}
      >
        {active.icon}
        <span className="text-xs font-semibold max-w-[64px] truncate">{active.name}</span>
        <ChevronUp className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="AI providers"
          className="absolute bottom-full left-0 mb-2 w-[calc(100vw-2rem)] max-w-64 p-1.5 bg-surface-elevated border border-border rounded-xl shadow-2xl z-50 text-xs animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60 mb-1">
            Choose provider
          </div>
          <div className="space-y-0.5">
            {PROVIDERS.map((p) => {
              const selected = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(p.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 w-full p-2 rounded-lg text-left transition-colors",
                    selected
                      ? "bg-accent/15 border border-accent/30 text-foreground"
                      : "hover:bg-surface-hover text-muted-foreground hover:text-foreground border border-transparent"
                  )}
                >
                  <div className="mt-0.5 shrink-0">{p.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{p.name}</span>
                      <span className="text-[9px] px-1.5 py-px rounded bg-surface border border-border text-slate-400 font-mono">
                        {p.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.tagline}</div>
                  </div>
                  {selected && <Check className="w-3.5 h-3.5 text-accent-light shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
