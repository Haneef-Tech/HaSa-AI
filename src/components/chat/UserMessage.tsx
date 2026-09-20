"use client";

import React, { useState } from "react";
import { Copy, Check, Pencil, FileText, X } from "lucide-react";
import { Message } from "@/types/chat";
import { formatTimestamp, cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface UserMessageProps {
  message: Message;
  onEdit?: (newContent: string) => void;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message, onEdit }) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSaveEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(editText.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="group relative flex flex-col items-end w-full max-w-3xl mx-auto my-3 px-4 sm:px-6">
      {/* Attachments if any */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 justify-end">
          {message.attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-slate-300"
            >
              <FileText className="w-3.5 h-3.5 text-violet-400" />
              <span className="font-medium truncate max-w-[150px]">{att.name}</span>
              <span className="text-[10px] text-muted-foreground">{att.size}</span>
            </div>
          ))}
        </div>
      )}

      {/* Message Box or Edit Area */}
      {isEditing ? (
        <div className="w-full rounded-2xl border border-violet-500/40 bg-surface p-3 shadow-lg">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground focus:outline-none resize-none font-sans leading-relaxed"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border">
            <button
              onClick={() => {
                setEditText(message.content);
                setIsEditing(false);
              }}
              className="px-2.5 py-1 text-xs rounded-lg text-muted-foreground hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 text-xs rounded-lg bg-accent text-white font-medium hover:bg-accent-dark transition-colors"
            >
              Save & Submit
            </button>
          </div>
        </div>
      ) : (
        <div className="relative max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 bg-[#1d2232] dark:bg-[#1a2030] text-slate-100 text-sm leading-relaxed shadow-sm border border-slate-700/40">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>

          <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-slate-400 select-none">
            <span>{formatTimestamp(message.createdAt)}</span>
          </div>
        </div>
      )}

      {/* Hover Actions Toolbar */}
      {!isEditing && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 mt-1 text-slate-400 select-none">
          <Tooltip content={copied ? "Copied!" : "Copy message"}>
            <button
              onClick={handleCopy}
              className="p-1 rounded-md hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
              aria-label="Copy user message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>

          {onEdit && (
            <Tooltip content="Edit message">
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded-md hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
                aria-label="Edit user message"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
};

