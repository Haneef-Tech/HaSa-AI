"use client";

import React from "react";
import { Message } from "@/types/chat";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";

interface MessageItemProps {
  message: Message;
  onEditUserMessage?: (messageId: string, newContent: string) => void;
  onRegenerateAssistant?: (messageId: string) => void;
  onContinueAssistant?: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onEditUserMessage,
  onRegenerateAssistant,
  onContinueAssistant,
}) => {
  if (message.role === "user") {
    return (
      <UserMessage
        message={message}
        onEdit={
          onEditUserMessage
            ? (newContent) => onEditUserMessage(message.id, newContent)
            : undefined
        }
      />
    );
  }

  return (
    <AssistantMessage
      message={message}
      onRegenerate={
        onRegenerateAssistant
          ? () => onRegenerateAssistant(message.id)
          : undefined
      }
      onContinue={
        onContinueAssistant
          ? () => onContinueAssistant(message.id)
          : undefined
      }
    />
  );
};

