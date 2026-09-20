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
  Archive,
  Bookmark,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Conversation } from "@/types/chat";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onOpenSearch,
  onOpenSettings,
  onRename,
  onDelete,
  onTogglePin,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Group conversations by time period
  const now = Date.now();
  const oneDay = 1000 * 60 * 60 * 24;

  const pinnedList = conversations.filter((c) => c.pinned && !c.archived);
  const unpinnedList = conversations.filter((c) => !c.pinned && !c.archived);

  const todayList = unpinnedList.filter((c) => {
    const time = new Date(c.updatedAt).getTime();
    return now - time < oneDay;
  });

  const yesterdayList = unpinnedList.filter((c) => {
    const time = new Date(c.updatedAt).getTime();
    return now - time >= oneDay && now - time < oneDay * 2;
  });

  const previous7DaysList = unpinnedList.filter((c) => {
    const time = new Date(c.updatedAt).getTime();
    return now - time >= oneDay * 2 && now - time < oneDay * 7;
  });

  const olderList = unpinnedList.filter((c) => {
    const time = new Date(c.updatedAt).getTime();
    return now - time >= oneDay * 7;
  });

  const renderConversationItem = (item: Conversation) => {
    const isActive = item.id === activeId;
    const isMenuOpen = activeMenuId === item.id;

    if (isCollapsed) {
      return (
        <Tooltip key={item.id} content={item.title} position="right">
          <button
            onClick={() => onSelectConversation(item.id)}
            className={cn(
              "w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-all focus-ring my-1",
              isActive
                ? "bg-accent/20 text-accent-light border border-accent/40 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            )}
            aria-label={item.title}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </Tooltip>
      );
    }

    return (
      <div
        key={item.id}
        className={cn(
          "group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all duration-150 my-0.5",
          isActive
            ? "bg-accent/15 text-foreground border border-accent/30 font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
        )}
      >
        <button
          onClick={() => onSelectConversation(item.id)}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left focus:outline-none"
        >
          {item.pinned ? (
            <Pin className="w-3.5 h-3.5 text-accent-light shrink-0" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
          )}
          <span className="truncate">{item.title}</span>
        </button>

        {/* Action button trigger */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuId(isMenuOpen ? null : item.id);
            }}
            className={cn(
              "p-1 rounded-md transition-opacity focus-ring",
              isMenuOpen
                ? "opacity-100 text-foreground bg-surface-hover"
                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            )}
            aria-label="Conversation actions"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-36 py-1 bg-surface-elevated border border-border rounded-xl shadow-2xl z-40 text-xs text-foreground animate-in fade-in-50 zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setActiveMenuId(null);
                  onRename(item.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-surface-hover transition-colors"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
                <span>Rename</span>
              </button>

              <button
                onClick={() => {
                  setActiveMenuId(null);
                  onTogglePin(item.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-surface-hover transition-colors"
              >
                <Pin className="w-3 h-3 text-muted-foreground" />
                <span>{item.pinned ? "Unpin" : "Pin"}</span>
              </button>

              <div className="h-[1px] bg-border my-1" />

              <button
                onClick={() => {
                  setActiveMenuId(null);
                  onDelete(item.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full border-r border-border bg-sidebar transition-all duration-200 select-none z-20",
        isCollapsed ? "w-16" : "w-72"
      )}
      aria-label="Sidebar navigation"
    >
      {/* Top Action Buttons: New Chat & Search */}
      <div className="p-3 border-b border-border/70 space-y-2">
        <button
          onClick={onNewChat}
          className={cn(
            "flex items-center justify-center gap-2 w-full rounded-xl bg-accent text-white font-medium hover:bg-accent-dark transition-all duration-150 shadow-sm focus-ring",
            isCollapsed ? "h-10 p-0" : "py-2 px-3 text-xs"
          )}
          aria-label="Start new chat"
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>New Chat</span>}
        </button>

        {!isCollapsed && (
          <button
            onClick={onOpenSearch}
            className="flex items-center justify-between w-full py-1.5 px-3 rounded-xl bg-surface border border-border/80 text-muted-foreground hover:text-foreground hover:bg-surface-hover text-xs transition-colors focus-ring"
            aria-label="Search conversation history"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Search chats</span>
            </div>
            <kbd className="text-[10px] font-mono bg-surface-elevated px-1 py-0.5 rounded border border-border">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Conversation List Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Pinned Section */}
        {pinnedList.length > 0 && (
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
                <Pin className="w-3 h-3 text-accent-light" />
                <span>Pinned</span>
              </div>
            )}
            {pinnedList.map(renderConversationItem)}
          </div>
        )}

        {/* Today */}
        {todayList.length > 0 && (
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Today
              </div>
            )}
            {todayList.map(renderConversationItem)}
          </div>
        )}

        {/* Yesterday */}
        {yesterdayList.length > 0 && (
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Yesterday
              </div>
            )}
            {yesterdayList.map(renderConversationItem)}
          </div>
        )}

        {/* Previous 7 Days */}
        {previous7DaysList.length > 0 && (
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Previous 7 Days
              </div>
            )}
            {previous7DaysList.map(renderConversationItem)}
          </div>
        )}

        {/* Older */}
        {olderList.length > 0 && (
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Older
              </div>
            )}
            {olderList.map(renderConversationItem)}
          </div>
        )}
      </div>

      {/* Saved Items & Bottom Controls */}
      <div className="p-2 border-t border-border/70 space-y-1 bg-surface/30">
        {!isCollapsed && (
          <button
            onClick={() => alert("Saved Notes: All ImportantContentCards and starred items are organized here in future updates.")}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 text-violet-400" />
            <span>Saved Insights</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className={cn(
            "flex items-center gap-2.5 w-full rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring",
            isCollapsed ? "h-10 justify-center p-0" : "px-2.5 py-1.5"
          )}
          aria-label="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
          {!isCollapsed && <span>Settings</span>}
        </button>

        {/* Collapse toggle button */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "flex items-center gap-2.5 w-full rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring",
            isCollapsed ? "h-10 justify-center p-0" : "px-2.5 py-1.5"
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

