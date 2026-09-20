"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, Mic, FileText, X } from "lucide-react";
import { ChatMode, Attachment } from "@/types/chat";
import { ModeSelector } from "./ModeSelector";
import { AttachmentButton } from "./AttachmentButton";
import { Tooltip } from "@/components/ui/tooltip";
import { estimateTokenCount, cn } from "@/lib/utils";

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  currentMode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
  disabled?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  onStopStreaming,
  isStreaming,
  currentMode,
  onSelectMode,
  disabled = false,
}) => {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 44), 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isStreaming || disabled) return;

    onSendMessage(trimmed, attachments);
    setText("");
    setAttachments([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  };

  const handleAddAttachments = (newFiles: Attachment[]) => {
    setAttachments((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Drag and drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles: Attachment[] = Array.from(e.dataTransfer.files).map((f) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: f.name,
        size: `${(f.size / 1024).toFixed(1)} KB`,
        type: f.type || "file",
      }));
      handleAddAttachments(droppedFiles);
    }
  };

  const tokenCount = estimateTokenCount(text);
  const canSubmit = text.trim().length > 0 || attachments.length > 0;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pb-4 sm:pb-6 select-none">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col rounded-2xl border bg-surface/90 backdrop-blur-md shadow-xl transition-all duration-200",
          isDragging
            ? "border-accent ring-2 ring-accent/30 bg-accent/5"
            : "border-border hover:border-slate-600/50 focus-within:border-accent-light focus-within:ring-2 focus-within:ring-accent/20"
        )}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 rounded-2xl bg-surface-elevated/95 flex flex-col items-center justify-center border-2 border-dashed border-accent-light pointer-events-none">
            <FileText className="w-8 h-8 text-accent-light mb-1 animate-bounce" />
            <span className="text-sm font-medium text-foreground">Drop files to attach</span>
          </div>
        )}

        {/* Attachment Chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-elevated border border-border text-xs text-foreground animate-in fade-in-0"
              >
                <FileText className="w-3.5 h-3.5 text-violet-400" />
                <span className="max-w-[140px] truncate font-medium">{file.name}</span>
                <span className="text-[10px] text-muted-foreground">({file.size})</span>
                <button
                  onClick={() => handleRemoveAttachment(file.id)}
                  className="p-0.5 hover:text-rose-400 rounded transition-colors"
                  aria-label={`Remove attachment ${file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Area */}
        <div className="p-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask HaSa AI anything... (Shift+Enter for newline)"
            rows={1}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none font-sans leading-relaxed selection:bg-accent/40"
            aria-label="Message composer"
          />
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <ModeSelector currentMode={currentMode} onSelectMode={onSelectMode} />
            <AttachmentButton onAttach={handleAddAttachments} disabled={disabled || isStreaming} />

            <Tooltip content="Voice input (Preview)">
              <button
                type="button"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors focus-ring"
                aria-label="Voice input preview"
              >
                <Mic className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          <div className="flex items-center gap-3">
            {/* Token Counter & Keyboard Hint */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              {text.trim().length > 0 && <span>~{tokenCount} tokens</span>}
            </div>

            {/* Send or Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-md transition-all focus-ring"
                aria-label="Stop generating response"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || disabled}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl text-white shadow-md transition-all duration-150 focus-ring",
                  canSubmit && !disabled
                    ? "bg-accent hover:bg-accent-dark hover:scale-105 active:scale-95"
                    : "bg-slate-700/40 text-slate-500 cursor-not-allowed opacity-50"
                )}
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-muted-foreground">
        <span>HaSa AI can make mistakes. Verify critical facts.</span>
        <span>•</span>
        <span className="font-mono">Routing preview active</span>
      </div>
    </div>
  );
};

