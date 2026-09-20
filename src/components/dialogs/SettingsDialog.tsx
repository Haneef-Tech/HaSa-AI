"use client";

import React, { useState } from "react";
import { X, Settings, Moon, Sun, Cpu, ShieldCheck, Check, Sparkles } from "lucide-react";
import { ChatMode } from "@/types/chat";
import { MOCK_MODES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  currentMode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  currentMode,
  onSelectMode,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "providers" | "about">("general");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Application settings"
    >
      <div
        className="w-full max-w-lg bg-surface-elevated border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-accent/15 text-accent-light">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Settings & Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border px-5 bg-surface/40 text-xs">
          <button
            onClick={() => setActiveTab("general")}
            className={cn(
              "py-2.5 px-3 border-b-2 font-medium transition-colors",
              activeTab === "general"
                ? "border-accent text-accent-light"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("providers")}
            className={cn(
              "py-2.5 px-3 border-b-2 font-medium transition-colors",
              activeTab === "providers"
                ? "border-accent text-accent-light"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Model Routing Preview
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={cn(
              "py-2.5 px-3 border-b-2 font-medium transition-colors",
              activeTab === "about"
                ? "border-accent text-accent-light"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            About HaSa AI
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-96 overflow-y-auto space-y-4">
          {activeTab === "general" && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Appearance Theme</label>
                <p className="text-muted-foreground mb-2">
                  Choose between high-contrast dark theme and clean light theme.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (theme !== "dark") onToggleTheme();
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                      theme === "dark"
                        ? "border-accent bg-accent/15 text-foreground font-semibold"
                        : "border-border bg-surface text-muted-foreground hover:bg-surface-hover"
                    )}
                  >
                    <Moon className="w-4 h-4 text-violet-400" />
                    <span>Dark Theme</span>
                    {theme === "dark" && <Check className="w-3.5 h-3.5 ml-1 text-accent-light" />}
                  </button>

                  <button
                    onClick={() => {
                      if (theme !== "light") onToggleTheme();
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                      theme === "light"
                        ? "border-accent bg-accent/15 text-foreground font-semibold"
                        : "border-border bg-surface text-muted-foreground hover:bg-surface-hover"
                    )}
                  >
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Light Theme</span>
                    {theme === "light" && <Check className="w-3.5 h-3.5 ml-1 text-accent-light" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <label className="font-semibold text-foreground block mb-1">
                  Default Routing Mode
                </label>
                <p className="text-muted-foreground mb-2">
                  Set the default intelligent mode applied to new conversations.
                </p>
                <div className="space-y-1.5">
                  {MOCK_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => onSelectMode(mode.mode)}
                      className={cn(
                        "flex items-center justify-between w-full p-2.5 rounded-lg border text-left transition-colors",
                        currentMode === mode.mode
                          ? "border-accent/40 bg-accent/10 text-foreground"
                          : "border-border/70 bg-surface text-muted-foreground hover:bg-surface-hover"
                      )}
                    >
                      <div>
                        <div className="font-semibold text-foreground">{mode.name}</div>
                        <div className="text-[11px] text-muted-foreground">{mode.description}</div>
                      </div>
                      {currentMode === mode.mode && (
                        <Check className="w-4 h-4 text-accent-light shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "providers" && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/30 text-violet-300">
                <span className="font-semibold">Architecture Preview:</span> Multi-provider routing layer configured for Groq, Gemini, and OpenRouter. Backend endpoints will connect in Phase 2.
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <div>
                      <div className="font-semibold text-foreground">Groq Cloud Adapter</div>
                      <div className="text-[11px] text-muted-foreground">Llama-3.3-70B, Llama-3.1-8B (Ultra low latency)</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-emerald-400 font-mono">Ready (Preview)</span>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <div>
                      <div className="font-semibold text-foreground">Google Gemini Adapter</div>
                      <div className="text-[11px] text-muted-foreground">Gemini 2.5 Flash, Gemini 1.5 Pro (Multimodal & Long Context)</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-emerald-400 font-mono">Ready (Preview)</span>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <div>
                      <div className="font-semibold text-foreground">OpenRouter Gateway</div>
                      <div className="text-[11px] text-muted-foreground">Claude 3.5 Sonnet, DeepSeek R1/V3, GPT-4o</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-emerald-400 font-mono">Ready (Preview)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div className="text-xs space-y-3 text-muted-foreground leading-relaxed">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-light" />
                <span className="font-semibold text-foreground">HaSa AI — Workspace Foundation</span>
              </div>
              <p>
                HaSa AI is designed as a provider-agnostic, task-aware intelligent chat platform. In this Phase 1 preview, all user experiences, code blocks, copy flows, and streaming responses run with realistic client-side simulations.
              </p>
              <div className="p-3 rounded-xl bg-surface border border-border text-[11px]">
                <div>Version: <span className="font-mono text-foreground">0.1.0-preview</span></div>
                <div className="mt-0.5">Stack: Next.js App Router, React, Tailwind CSS, TypeScript</div>
                <div className="mt-0.5">Routing Engine: Client Mock Streamer (Phase 1)</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-surface-elevated border border-border hover:bg-surface-hover text-foreground rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

