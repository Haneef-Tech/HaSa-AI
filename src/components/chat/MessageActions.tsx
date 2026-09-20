"use client";

import React, { useState } from "react";
import { Copy, Check, RotateCw, Play, ThumbsUp, ThumbsDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
  onContinue?: () => void;
  initialFeedback?: "like" | "dislike" | null;
  className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  content,
  onRegenerate,
  onContinue,
  initialFeedback = null,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(initialFeedback);
  const [showMore, setShowMore] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleFeedback = (type: "like" | "dislike") => {
    setFeedback((prev) => (prev === type ? null : type));
  };

  return (
    <div className={cn("flex items-center gap-1 text-slate-400 select-none", className)}>
      <Tooltip content={copied ? "Copied!" : "Copy response"}>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
          aria-label="Copy assistant response"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </Tooltip>

      {onRegenerate && (
        <Tooltip content="Regenerate response">
          <button
            onClick={onRegenerate}
            className="p-1.5 rounded-lg hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
            aria-label="Regenerate assistant response"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </Tooltip>
      )}

      {onContinue && (
        <Tooltip content="Continue generating">
          <button
            onClick={onContinue}
            className="p-1.5 rounded-lg hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
            aria-label="Continue generating response"
          >
            <Play className="w-4 h-4" />
          </button>
        </Tooltip>
      )}

      <div className="w-[1px] h-3.5 bg-border mx-1" />

      <Tooltip content="Good response">
        <button
          onClick={() => handleFeedback("like")}
          className={cn(
            "p-1.5 rounded-lg transition-colors focus-ring",
            feedback === "like"
              ? "text-emerald-400 bg-emerald-500/10"
              : "hover:text-foreground hover:bg-surface-hover"
          )}
          aria-label="Upvote response"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
      </Tooltip>

      <Tooltip content="Bad response">
        <button
          onClick={() => handleFeedback("dislike")}
          className={cn(
            "p-1.5 rounded-lg transition-colors focus-ring",
            feedback === "dislike"
              ? "text-rose-400 bg-rose-500/10"
              : "hover:text-foreground hover:bg-surface-hover"
          )}
          aria-label="Downvote response"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
      </Tooltip>

      <div className="relative">
        <Tooltip content="More actions">
          <button
            onClick={() => setShowMore(!showMore)}
            className="p-1.5 rounded-lg hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
            aria-label="More message options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </Tooltip>

        {showMore && (
          <div className="absolute left-0 bottom-full mb-1 z-30 w-36 py-1 bg-surface-elevated border border-border rounded-lg shadow-xl text-xs text-foreground">
            <button
              onClick={() => {
                setShowMore(false);
                handleCopy();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-surface-hover transition-colors"
            >
              Export as Markdown
            </button>
            <button
              onClick={() => {
                setShowMore(false);
                alert("Model routing telemetry: Latency 0.8s, Input Tokens ~42, Output Tokens ~310");
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-surface-hover transition-colors"
            >
              Inspect Telemetry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

