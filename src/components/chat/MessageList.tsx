"use client";

import React, { useRef, useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Message } from "@/types/chat";
import { MessageItem } from "./MessageItem";
import { EmptyChat } from "./EmptyChat";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
  onSelectPrompt: (prompt: string) => void;
  onEditUserMessage?: (messageId: string, newContent: string) => void;
  onRegenerateAssistant?: (messageId: string) => void;
  onContinueAssistant?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming = false,
  onSelectPrompt,
  onEditUserMessage,
  onRegenerateAssistant,
  onContinueAssistant,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const userScrolledRef = useRef(false);

  // Auto-scroll to bottom if user is already near bottom
  useEffect(() => {
    if (!userScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceFromBottom > 150;
    setShowScrollBottom(isUp);
    userScrolledRef.current = isUp;
  };

  const scrollToBottom = () => {
    userScrolledRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <EmptyChat onSelectPrompt={onSelectPrompt} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto relative w-full py-6"
      role="log"
      aria-label="Conversation history"
      aria-live="polite"
    >
      <div className="flex flex-col space-y-2 pb-6">
        {messages.map((message) => (
          <div key={message.id} className="message-enter">
            <MessageItem
              message={message}
              onEditUserMessage={onEditUserMessage}
              onRegenerateAssistant={onRegenerateAssistant}
              onContinueAssistant={onContinueAssistant}
            />
          </div>
        ))}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-28 right-8 z-30 p-2.5 rounded-full bg-surface-elevated border border-border text-foreground shadow-xl hover:bg-surface-hover hover:border-accent-light transition-all duration-150 focus-ring animate-in fade-in-0 zoom-in-95"
          aria-label="Scroll to latest message"
        >
          <ArrowDown className="w-4 h-4 text-accent-light" />
        </button>
      )}
    </div>
  );
};

