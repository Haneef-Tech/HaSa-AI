"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { Conversation, Message, ChatMode, Attachment } from "@/types/chat";
import {
  INITIAL_CONVERSATIONS,
  MOCK_MESSAGES_MAP,
  MOCK_MODES,
  getMockResponseForPrompt,
} from "@/lib/mock-data";
import { simulateStream } from "@/lib/mock-streamer";
import { generateId } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface ChatContextType {
  theme: "dark" | "light";
  toggleTheme: () => void;
  currentMode: ChatMode;
  setCurrentMode: (mode: ChatMode) => void;

  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  messages: Message[];
  isStreaming: boolean;

  isSidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  // Dialog states
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  renameTargetId: string | null;
  setRenameTargetId: (id: string | null) => void;
  deleteTargetId: string | null;
  setDeleteTargetId: (id: string | null) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Chat Actions
  selectConversation: (id: string) => void;
  createNewChat: () => void;
  sendMessage: (content: string, attachments?: Attachment[]) => void;
  stopStreaming: () => void;
  editUserMessage: (messageId: string, newContent: string) => void;
  regenerateAssistant: (messageId: string) => void;
  continueAssistant: (messageId: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  deleteConversation: (id: string) => void;
  togglePinConversation: (id: string) => void;
  exportConversation: (id?: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Check localStorage or initial class
    const saved = localStorage.getItem("hasa_theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.classList.toggle("light", saved === "light");
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("hasa_theme", next);
      document.documentElement.classList.toggle("light", next === "light");
      toast(`Switched to ${next} theme`, "info");
      return next;
    });
  };

  // Mode state
  const [currentMode, setCurrentMode] = useState<ChatMode>("auto");

  // Conversations & messages state
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    INITIAL_CONVERSATIONS[0].id
  );
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(MOCK_MESSAGES_MAP);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sidebar states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Dialogs
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;
  const currentMessages = activeConversationId ? messagesMap[activeConversationId] || [] : [];

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const selectConversation = (id: string) => {
    if (isStreaming) {
      stopStreaming();
    }
    setActiveConversationId(id);
  };

  const createNewChat = () => {
    if (isStreaming) {
      stopStreaming();
    }
    const newId = generateId("conv");
    const newConv: Conversation = {
      id: newId,
      title: "New conversation",
      updatedAt: new Date().toISOString(),
      pinned: false,
      messageCount: 0,
    };
    setConversations((prev) => [newConv, ...prev]);
    setMessagesMap((prev) => ({ ...prev, [newId]: [] }));
    setActiveConversationId(newId);
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);

    if (activeConversationId) {
      setMessagesMap((prev) => {
        const msgs = prev[activeConversationId] || [];
        return {
          ...prev,
          [activeConversationId]: msgs.map((m) =>
            m.isStreaming ? { ...m, isStreaming: false } : m
          ),
        };
      });
    }
  };

  const sendMessage = useCallback(
    async (content: string, attachments: Attachment[] = []) => {
      if (isStreaming) return;

      let convId = activeConversationId;
      let isFirstMessage = false;

      // If no conversation exists or current is empty, initialize or update title
      if (!convId || !conversations.some((c) => c.id === convId)) {
        convId = generateId("conv");
        const newConv: Conversation = {
          id: convId,
          title: content.slice(0, 36) || "New conversation",
          updatedAt: new Date().toISOString(),
          pinned: false,
          messageCount: 0,
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(convId);
        isFirstMessage = true;
      } else {
        const currentConv = conversations.find((c) => c.id === convId);
        if (currentConv && currentConv.title === "New conversation") {
          isFirstMessage = true;
        }
      }

      const userMsg: Message = {
        id: generateId("usr"),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const modeObj = MOCK_MODES.find((m) => m.mode === currentMode) || MOCK_MODES[0];
      const assistantMsgId = generateId("ast");
      const placeholderAssistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        provider: modeObj.provider,
        model: `${modeObj.name} Mode Preview`,
        latency: modeObj.latencyAvg || "0.8s",
        mode: currentMode,
        isStreaming: true,
      };

      // Update state with user message and placeholder assistant message
      setMessagesMap((prev) => ({
        ...prev,
        [convId as string]: [...(prev[convId as string] || []), userMsg, placeholderAssistantMsg],
      }));

      // Update conversation title and updatedAt
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              title: isFirstMessage ? content.slice(0, 38) : c.title,
              updatedAt: new Date().toISOString(),
              lastMessageSnippet: content.slice(0, 80),
              messageCount: (c.messageCount || 0) + 2,
            };
          }
          return c;
        })
      );

      // Start realistic streaming
      setIsStreaming(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const mockResponseText = getMockResponseForPrompt(content, currentMode);

      try {
        await simulateStream(mockResponseText, {
          chunkDelayMs: 25,
          signal: controller.signal,
          onChunk: (accumulated) => {
            setMessagesMap((prev) => {
              const msgs = prev[convId as string] || [];
              return {
                ...prev,
                [convId as string]: msgs.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: accumulated } : m
                ),
              };
            });
          },
        });
      } catch (err) {
        console.error("Stream simulation error", err);
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setMessagesMap((prev) => {
          const msgs = prev[convId as string] || [];
          return {
            ...prev,
            [convId as string]: msgs.map((m) =>
              m.id === assistantMsgId ? { ...m, isStreaming: false } : m
            ),
          };
        });
      }
    },
    [activeConversationId, conversations, currentMode, isStreaming]
  );

  const editUserMessage = (messageId: string, newContent: string) => {
    if (!activeConversationId) return;

    // Update message content
    setMessagesMap((prev) => {
      const msgs = prev[activeConversationId] || [];
      return {
        ...prev,
        [activeConversationId]: msgs.map((m) =>
          m.id === messageId ? { ...m, content: newContent } : m
        ),
      };
    });

    toast("Message updated. Re-generating answer...", "info");
    sendMessage(newContent);
  };

  const regenerateAssistant = (messageId: string) => {
    if (!activeConversationId) return;
    const msgs = messagesMap[activeConversationId] || [];
    const index = msgs.findIndex((m) => m.id === messageId);
    if (index > 0 && msgs[index - 1].role === "user") {
      const userPrompt = msgs[index - 1].content;
      // Remove old assistant message
      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: prev[activeConversationId].filter((m) => m.id !== messageId),
      }));
      toast("Regenerating response...", "info");
      sendMessage(userPrompt);
    }
  };

  const continueAssistant = (messageId: string) => {
    if (!activeConversationId) return;
    sendMessage("Please continue from where you left off with more practical examples.");
  };

  const renameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
    toast("Conversation renamed", "success");
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessagesMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        createNewChat();
      }
    }
    toast("Conversation deleted", "info");
  };

  const togglePinConversation = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextPinned = !c.pinned;
          toast(nextPinned ? "Conversation pinned" : "Conversation unpinned", "info");
          return { ...c, pinned: nextPinned };
        }
        return c;
      })
    );
  };

  const exportConversation = (id?: string) => {
    const targetId = id || activeConversationId;
    if (!targetId) return;
    const conv = conversations.find((c) => c.id === targetId);
    const msgs = messagesMap[targetId] || [];

    let markdown = `# ${conv?.title || "HaSa AI Conversation"}\n\n`;
    markdown += `*Exported from HaSa AI on ${new Date().toLocaleString()}*\n\n---\n\n`;

    msgs.forEach((m) => {
      const roleLabel = m.role === "user" ? "### User" : `### HaSa AI (${m.model || "Auto"})`;
      markdown += `${roleLabel}\n\n${m.content}\n\n---\n\n`;
    });

    // Create download trigger
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(conv?.title || "conversation").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Conversation exported as Markdown", "success");
  };

  return (
    <ChatContext.Provider
      value={{
        theme,
        toggleTheme,
        currentMode,
        setCurrentMode,
        conversations,
        activeConversationId,
        activeConversation,
        messages: currentMessages,
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
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

