import type { ChatMode } from "@/types/chat";
import type { TaskType } from "@/lib/routing/task-classifier";
import type { ProviderId } from "@/lib/providers/provider.types";

export interface UsageRecord {
  conversationId: string;
  provider: ProviderId | string;
  model: string;
  task: TaskType;
  mode: ChatMode;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  fallbackUsed: boolean;
  latencyMs: number;
  createdAt: string;
}
