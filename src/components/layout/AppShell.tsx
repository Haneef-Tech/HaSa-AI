"use client";

import React from "react";
import { useChat } from "@/context/ChatContext";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { SearchDialog } from "@/components/dialogs/SearchDialog";
import { RenameConversationDialog } from "@/components/dialogs/RenameConversationDialog";
import { DeleteConversationDialog } from "@/components/dialogs/DeleteConversationDialog";
import { SettingsDialog } from "@/components/dialogs/SettingsDialog";

export const AppShell: React.FC = () => {
  const {
    theme,
    toggleTheme,
    currentMode,
    setCurrentMode,
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isStreaming,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    isSearchOpen,
    setSearchOpen,
    renameTargetId,
    setRenameTargetId,
    deleteTargetId,
    setDeleteTargetId,
    isSettingsOpen,
    setSettingsOpen,
    selectConversation,
    createNewChat,
    sendMessage,
    stopStreaming,
    editUserMessage,
    regenerateAssistant,
    continueAssistant,
    renameConversation,
    deleteConversation,
    togglePinConversation,
    exportConversation,
  } = useChat();

  const targetRenameConv = conversations.find((c) => c.id === renameTargetId);
  const targetDeleteConv = conversations.find((c) => c.id === deleteTargetId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Top Navigation */}
      <TopNav
        onToggleSidebar={() => {
          // On mobile, toggle drawer; on desktop, toggle collapsed state
          if (window.innerWidth < 768) {
            setMobileSidebarOpen(!isMobileSidebarOpen);
          } else {
            toggleSidebarCollapse();
          }
        }}
        isSidebarOpen={!isSidebarCollapsed}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
      />

      {/* Main App Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Collapsible Sidebar */}
        <Sidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelectConversation={selectConversation}
          onNewChat={createNewChat}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onRename={(id) => setRenameTargetId(id)}
          onDelete={(id) => setDeleteTargetId(id)}
          onTogglePin={togglePinConversation}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />

        {/* Mobile Slide-Over Drawer */}
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          conversations={conversations}
          activeId={activeConversationId}
          onSelectConversation={selectConversation}
          onNewChat={createNewChat}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onRename={(id) => setRenameTargetId(id)}
          onDelete={(id) => setDeleteTargetId(id)}
          onTogglePin={togglePinConversation}
        />

        {/* Center Chat Workspace */}
        <ChatWorkspace
          conversation={activeConversation}
          messages={messages}
          isStreaming={isStreaming}
          currentMode={currentMode}
          onSelectMode={setCurrentMode}
          onSendMessage={sendMessage}
          onStopStreaming={stopStreaming}
          onSelectPrompt={(prompt) => sendMessage(prompt)}
          onEditUserMessage={editUserMessage}
          onRegenerateAssistant={regenerateAssistant}
          onContinueAssistant={continueAssistant}
          onRenameConversation={(newTitle) => {
            if (activeConversationId) renameConversation(activeConversationId, newTitle);
          }}
          onTogglePin={() => {
            if (activeConversationId) togglePinConversation(activeConversationId);
          }}
          onDeleteConversation={() => {
            if (activeConversationId) setDeleteTargetId(activeConversationId);
          }}
          onExportConversation={() => exportConversation()}
        />
      </div>

      {/* Dialogs */}
      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        conversations={conversations}
        onSelectConversation={selectConversation}
      />

      <RenameConversationDialog
        isOpen={!!renameTargetId}
        onClose={() => setRenameTargetId(null)}
        currentTitle={targetRenameConv?.title || ""}
        onSave={(newTitle) => {
          if (renameTargetId) renameConversation(renameTargetId, newTitle);
        }}
      />

      <DeleteConversationDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        conversationTitle={targetDeleteConv?.title || ""}
        onConfirm={() => {
          if (deleteTargetId) deleteConversation(deleteTargetId);
        }}
      />

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
      />
    </div>
  );
};

