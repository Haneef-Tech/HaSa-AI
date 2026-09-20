"use client";

import React, { useState } from "react";
import { Info, AlertTriangle, CheckCircle, Copy, Check, Bookmark, X } from "lucide-react";
import { ImportantContentProps } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export const ImportantContentCard: React.FC<ImportantContentProps> = ({
  variant = "info",
  title,
  content,
  onDismiss,
  onSave,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSave = () => {
    setSaved(!saved);
    if (onSave) onSave();
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  const variantStyles = {
    info: {
      border: "border-l-4 border-l-violet-500 border-violet-500/20",
      bg: "bg-violet-100 dark:bg-violet-950/25",
      icon: <Info className="w-4 h-4 text-violet-500 dark:text-violet-400 shrink-0 mt-0.5" />,
      badge: "text-violet-600 dark:text-violet-400 font-semibold",
    },
    warning: {
      border: "border-l-4 border-l-amber-500 border-amber-500/20",
      bg: "bg-amber-100 dark:bg-amber-950/25",
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
      badge: "text-amber-700 dark:text-amber-400 font-semibold",
    },
    success: {
      border: "border-l-4 border-l-emerald-500 border-emerald-500/20",
      bg: "bg-emerald-100 dark:bg-emerald-950/25",
      icon: <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
      badge: "text-emerald-700 dark:text-emerald-400 font-semibold",
    },
  };

  const style = variantStyles[variant] || variantStyles.info;

  return (
    <aside
      role="note"
      aria-label={title || "Important Information"}
      className={cn(
        "my-4 p-4 rounded-r-xl rounded-l-md border shadow-sm transition-all duration-200",
        style.border,
        style.bg,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {style.icon}
          <div className="flex-1 min-w-0">
            {title && (
              <div className={cn("text-xs uppercase tracking-wider mb-1", style.badge)}>
                {title}
              </div>
            )}
            <div className="text-sm leading-relaxed text-foreground/90 font-normal select-text">
              {content}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
          <Tooltip content={copied ? "Copied!" : "Copy note"}>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/80 transition-colors focus-ring"
              aria-label="Copy note content"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </Tooltip>

          <Tooltip content={saved ? "Saved" : "Save note"}>
            <button
              onClick={handleSave}
              className={cn(
                "p-1.5 rounded-lg transition-colors focus-ring",
                saved
                  ? "text-violet-400 bg-violet-500/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/80"
              )}
              aria-label="Save note"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="Dismiss">
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/80 transition-colors focus-ring"
              aria-label="Dismiss note"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
};

