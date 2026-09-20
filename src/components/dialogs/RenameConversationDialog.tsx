"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Pencil } from "lucide-react";

interface RenameConversationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentTitle: string;
  onSave: (newTitle: string) => void;
}

export const RenameConversationDialog: React.FC<RenameConversationDialogProps> = ({
  isOpen,
  onClose,
  currentTitle,
  onSave,
}) => {
  const [title, setTitle] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, currentTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Rename conversation"
    >
      <div
        className="w-full max-w-md bg-surface-elevated border border-border rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/15 text-accent-light">
              <Pencil className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Rename Conversation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Conversation Title
          </label>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-xl text-foreground focus-ring"
            placeholder="Enter title..."
            required
          />

          <div className="flex items-center justify-end gap-2.5 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Save Title
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

