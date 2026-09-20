import { z } from "zod";

export const chatModeSchema = z.enum(["auto", "fast", "balanced", "reasoning"]);

export const chatRequestSchema = z.object({
  conversationId: z
    .string()
    .min(1, "conversationId is required")
    .max(128, "conversationId is too long")
    .regex(/^[A-Za-z0-9_-]+$/, "conversationId contains invalid characters"),
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(8000, "Message exceeds maximum length of 8000 characters"),
  mode: chatModeSchema.optional().default("auto"),
  // Manual model override — server validates it against the enabled registry.
  requestedModel: z
    .string()
    .trim()
    .min(1, "requestedModel cannot be empty")
    .max(256, "requestedModel is too long")
    .optional(),
  // Provider-only selection (the UI exposes providers, not model IDs).
  requestedProvider: z.enum(["groq", "gemini", "openrouter", "narorouter"]).optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

export const MAX_CHAT_MESSAGE_LENGTH = 8000;
export const MAX_CONTEXT_MESSAGES = 20;
