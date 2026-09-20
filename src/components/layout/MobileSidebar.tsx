"use client";

import React, { useState } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Settings,
  Bookmark,
} from "lucide-react";
import { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onOpenSearch,
  onOpenSettings,
  onRename,
  onDelete,
  onTogglePin,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <aside className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-sidebar border-r border-border flex flex-col z-50 shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-border/80">
          <span className="text-sm font-semibold text-foreground">Conversations</span>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Actions */}
        <div className="p-3 border-b border-border/70 space-y-2">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-accent text-white font-medium hover:bg-accent-dark text-xs shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenSearch();
            }}
            className="flex items-center gap-2 w-full py-2 px-3 rounded-xl bg-surface border border-border/80 text-muted-foreground text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search chats...</span>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((item) => {
            const isActive = item.id === activeId;
            const isMenuOpen = activeMenuId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors",
                  isActive
                    ? "bg-accent/15 text-foreground border border-accent/30 font-semibold"
                    : "text-muted-foreground hover:bg-surface-hover"
                )}
              >
                <button
                  onClick={() => {
                    onSelectConversation(item.id);
                    onClose();
                  }}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                >
                  {item.pinned ? (
                    <Pin className="w-3.5 h-3.5 text-accent-light shrink-0" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{item.title}</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setActiveMenuId(isMenuOpen ? null : item.id)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                    aria-label="Conversation options"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {isMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 w-36 py-1 bg-surface-elevated border border-border rounded-xl shadow-2xl z-50 text-xs text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          onClose();
                          onRename(item.id);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-surface-hover"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Rename</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          onTogglePin(item.id);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-surface-hover"
                      >
                        <Pin className="w-3 h-3" />
                        <span>{item.pinned ? "Unpin" : "Pin"}</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          onClose();
                          onDelete(item.id);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom controls */}
        <div className="p-3 border-t border-border/70 space-y-1">
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </div>
  );
};

