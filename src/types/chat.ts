export type ChatMode = "auto" | "fast" | "balanced" | "reasoning";

export type MessageRole = "user" | "assistant" | "system";

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  provider?: string;
  model?: string;
  latency?: string;
  mode?: ChatMode;
  tokenUsage?: TokenUsage;
  isImportant?: boolean;
  isStreaming?: boolean;
  error?: boolean;
  errorMessage?: string;
  attachments?: Attachment[];
  feedback?: "like" | "dislike" | null;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt: string;
  selectedMode?: ChatMode;
  summary?: string;
  messageCount?: number;
  lastMessagePreview?: string;
  lastMessageSnippet?: string;
  pinned?: boolean;
  archived?: boolean;
}

export type ImportantVariant = "info" | "warning" | "success";

export interface ImportantContentProps {
  variant?: ImportantVariant;
  title?: string;
  content: string;
  onDismiss?: () => void;
  onSave?: () => void;
  className?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  mode: ChatMode;
  description: string;
  badge?: string;
  latencyAvg?: string;
}

export type SavedItemType = "info" | "warning" | "success" | "note";

export interface SavedItem {
  id: string;
  conversationId: string;
  messageId: string;
  title: string;
  content: string;
  type: SavedItemType;
  tags: string[];
  createdAt: string;
}

export interface UserPreferences {
  theme: "dark" | "light" | "system";
  defaultMode: ChatMode;
  updatedAt?: string;
}

export type ChatStreamEvent =
  | {
      type: "metadata";
      messageId: string;
      provider: string;
      model: string;
      mode: ChatMode;
      task: string;
      fallbackUsed: boolean;
      isMock: boolean;
    }
  | {
      type: "token";
      content: string;
    }
  | {
      type: "complete";
      messageId: string;
      message: Message;
      usage?: TokenUsage;
      provider: string;
      model: string;
      fallbackUsed: boolean;
    }
  | {
      type: "error";
      code: string;
      message: string;
      retryable: boolean;
    };

export type ChatRequest = {
  conversationId: string;
  message: string;
  mode?: ChatMode;
  /** Manual model override — must be an enabled registry model. */
  requestedModel?: string;
};
