"use client";

import React, { useState, useRef, useEffect } from "react";
import { Menu, Search, Moon, Sun, Sparkles, LogOut, Sliders, ChevronDown } from "lucide-react";
import { HasaWordmark } from "@/components/branding/HasaWordmark";
import { ChatMode } from "@/types/chat";
import { ModeSelector } from "@/components/composer/ModeSelector";
import { Tooltip } from "@/components/ui/tooltip";

interface TopNavProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  currentMode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  onOpenSearch,
  onOpenSettings,
  theme,
  onToggleTheme,
  currentMode,
  onSelectMode,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 w-full border-b border-border bg-surface/80 backdrop-blur-md z-30 select-none">
      <div className="h-full flex items-center px-3 sm:px-4 gap-2">

        {/* ── LEFT ── */}
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}>
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </Tooltip>
          <HasaWordmark size="md" />
        </div>

        {/* ── CENTER: grows to fill remaining space ── */}
        <div className="flex-1 hidden md:flex justify-center px-4">
          <button
            onClick={onOpenSearch}
            className="flex items-center justify-between w-full max-w-xs px-3 py-1.5 rounded-xl bg-surface border border-border/80 hover:border-violet-500/40 text-xs text-muted-foreground transition-all focus-ring"
            aria-label="Search conversations"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Search conversations...</span>
            </div>
            <div className="flex items-center gap-0.5 font-mono text-[10px] bg-surface-elevated px-1.5 py-0.5 rounded border border-border ml-3 shrink-0">
              <span>⌘K</span>
            </div>
          </button>
        </div>

        {/* ── RIGHT ── fixed width, never wraps */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* Mobile search icon */}
          <Tooltip content="Search">
            <button
              onClick={onOpenSearch}
              className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </Tooltip>

          {/* Mode selector (sm+) */}
          <div className="hidden sm:block">
            <ModeSelector currentMode={currentMode} onSelectMode={onSelectMode} />
          </div>

          {/* Theme toggle */}
          <Tooltip content={theme === "dark" ? "Light mode" : "Dark mode"}>
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? <Sun className="w-4 h-4 text-amber-400" />
                : <Moon className="w-4 h-4 text-violet-400" />}
            </button>
          </Tooltip>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setShowProfileMenu(v => !v)}
              className="flex items-center gap-1 p-1 pr-1.5 rounded-xl hover:bg-surface-hover transition-colors focus-ring"
              aria-label="Profile menu"
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                H
              </div>
              <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
            </button>

            {showProfileMenu && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] w-52 py-1.5 bg-surface-elevated border border-border rounded-xl shadow-2xl z-[200] text-xs text-foreground"
              >
                <div className="px-3.5 py-2 border-b border-border/70">
                  <div className="font-semibold text-foreground">HaSa AI</div>
                  <div className="text-[11px] text-muted-foreground truncate">workspace@hasa.ai</div>
                </div>

                <div className="py-1">
                  <button
                    role="menuitem"
                    onClick={() => { setShowProfileMenu(false); onOpenSettings(); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-left"
                  >
                    <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Preferences</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-border/70">
                  <button
                    role="menuitem"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
};
