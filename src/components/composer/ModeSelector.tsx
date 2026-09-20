"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Sparkles, Zap, Scale, Brain, Check } from "lucide-react";
import { ChatMode } from "@/types/chat";
import { MOCK_MODES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  currentMode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
  className?: string;
  placement?: "top" | "bottom";
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  className = "",
  placement = "bottom",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModeObj = MOCK_MODES.find((m) => m.mode === currentMode) || MOCK_MODES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getModeIcon = (mode: ChatMode) => {
    switch (mode) {
      case "auto":
        return <Sparkles className="w-3.5 h-3.5 text-violet-400" />;
      case "fast":
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case "balanced":
        return <Scale className="w-3.5 h-3.5 text-cyan-400" />;
      case "reasoning":
        return <Brain className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div ref={dropdownRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border/80 hover:bg-surface-elevated hover:border-violet-500/40 text-xs font-medium text-foreground transition-all focus-ring select-none"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select chat mode. Current mode: ${activeModeObj.name}`}
      >
        {getModeIcon(currentMode)}
        <span>{activeModeObj.name}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={cn(
            "absolute right-0 w-72 max-w-[calc(100vw-1.5rem)] p-1.5 bg-surface-elevated border border-border rounded-xl shadow-2xl z-50 text-xs animate-in fade-in-0 zoom-in-95 duration-200",
            placement === "top" ? "top-full mt-2" : "bottom-full mb-2"
          )}
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60 mb-1">
            Model Routing Strategy
          </div>

          <div className="space-y-1">
            {MOCK_MODES.map((option) => {
              const isSelected = option.mode === currentMode;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onSelectMode(option.mode);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-start gap-2.5 w-full p-2 rounded-lg text-left transition-colors",
                    isSelected
                      ? "bg-accent/15 border border-accent/30 text-foreground"
                      : "hover:bg-surface-hover text-muted-foreground hover:text-foreground"
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="mt-0.5">{getModeIcon(option.mode)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground">{option.name}</span>
                      {option.badge && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface border border-border text-slate-400 font-mono">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {option.description}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {option.provider} • {option.latencyAvg}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

