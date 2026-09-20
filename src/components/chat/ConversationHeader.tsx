"use client";

import React, { useState } from "react";
import { Pin, Check, Pencil, MoreVertical, Trash2, Download, Sparkles, Activity } from "lucide-react";
import { Conversation, ChatMode } from "@/types/chat";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ConversationHeaderProps {
  conversation: Conversation | null;
  mode: ChatMode;
  onRename: (newTitle: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onExport: () => void;
  isStreaming?: boolean;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  mode,
  onRename,
  onTogglePin,
  onDelete,
  onExport,
  isStreaming = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(conversation?.title || "New conversation");
  const [showMenu, setShowMenu] = useState(false);

  // Sync state if conversation changes
  React.useEffect(() => {
    setTitle(conversation?.title || "New conversation");
  }, [conversation?.title]);

  const handleSaveTitle = () => {
    if (title.trim()) {
      onRename(title.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveTitle();
    if (e.key === "Escape") {
      setTitle(conversation?.title || "New conversation");
      setIsEditing(false);
    }
  };

  const modeLabel = {
    auto: "Auto mode — smart routing",
    fast: "Fast mode (Groq)",
    balanced: "Balanced mode (Gemini)",
    reasoning: "Reasoning mode (OpenRouter)",
  }[mode];

  return (
    <header className="flex items-center justify-between h-14 px-4 sm:px-6 border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-20">
      {/* Title & Status Indicator */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveTitle}
              autoFocus
              className="w-full px-2 py-1 text-sm bg-surface-elevated border border-accent rounded-md text-foreground focus-ring font-medium"
            />
            <button
              onClick={handleSaveTitle}
              className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded-md"
              aria-label="Save title"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 group">
              <h2 className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {conversation?.title || "New conversation"}
              </h2>
              <Tooltip content="Rename title">
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                  aria-label="Rename conversation title"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground select-none">
              <span className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-accent-light" />
                <span>{modeLabel}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isStreaming ? "bg-accent-light animate-ping" : "bg-emerald-400"
                  )}
                />
                <span>{isStreaming ? "Generating..." : "Ready"}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {conversation && (
          <Tooltip content={conversation.pinned ? "Unpin chat" : "Pin chat"}>
            <button
              onClick={onTogglePin}
              className={cn(
                "p-2 rounded-lg transition-colors focus-ring",
                conversation.pinned
                  ? "text-accent-light bg-accent/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              )}
              aria-label="Pin conversation"
            >
              <Pin className="w-4 h-4" />
            </button>
          </Tooltip>
        )}

        {/* Dropdown Menu */}
        <div className="relative">
          <Tooltip content="More options">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
              aria-label="More conversation options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </Tooltip>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 py-1.5 bg-surface-elevated border border-border rounded-xl shadow-2xl z-40 text-xs text-foreground animate-in fade-in-50 zoom-in-95">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Rename Chat</span>
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  onExport();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Export Chat</span>
              </button>

              <div className="h-[1px] bg-border my-1" />

              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

