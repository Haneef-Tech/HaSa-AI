"use client";

import React from "react";
import { Conversation, Message, ChatMode, Attachment } from "@/types/chat";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList";
import { ChatComposer } from "@/components/composer/ChatComposer";

interface ChatWorkspaceProps {
  conversation: Conversation | null;
  messages: Message[];
  isStreaming: boolean;
  currentMode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  onStopStreaming: () => void;
  onSelectPrompt: (prompt: string) => void;
  onEditUserMessage: (messageId: string, newContent: string) => void;
  onRegenerateAssistant: (messageId: string) => void;
  onContinueAssistant: (messageId: string) => void;
  onRenameConversation: (newTitle: string) => void;
  onTogglePin: () => void;
  onDeleteConversation: () => void;
  onExportConversation: () => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  conversation,
  messages,
  isStreaming,
  currentMode,
  onSelectMode,
  onSendMessage,
  onStopStreaming,
  onSelectPrompt,
  onEditUserMessage,
  onRegenerateAssistant,
  onContinueAssistant,
  onRenameConversation,
  onTogglePin,
  onDeleteConversation,
  onExportConversation,
}) => {
  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
      {/* Conversation Header */}
      <ConversationHeader
        conversation={conversation}
        mode={currentMode}
        onRename={onRenameConversation}
        onTogglePin={onTogglePin}
        onDelete={onDeleteConversation}
        onExport={onExportConversation}
        isStreaming={isStreaming}
      />

      {/* Message Feed & History */}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onSelectPrompt={onSelectPrompt}
        onEditUserMessage={onEditUserMessage}
        onRegenerateAssistant={onRegenerateAssistant}
        onContinueAssistant={onContinueAssistant}
      />

      {/* Input Composer */}
      <ChatComposer
        onSendMessage={onSendMessage}
        onStopStreaming={onStopStreaming}
        isStreaming={isStreaming}
        currentMode={currentMode}
        onSelectMode={onSelectMode}
      />
    </main>
  );
};

