import { z } from "zod";
import { chatModeSchema } from "./chat-schemas";

const objectIdSchema = z
  .string()
  .min(1, "ID is required")
  .max(128, "ID is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "ID contains invalid characters");

export const conversationIdSchema = objectIdSchema;

export const createConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title exceeds maximum length of 120 characters")
    .optional()
    .default("New conversation"),
  selectedMode: chatModeSchema.optional().default("auto"),
});

export const updateConversationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(120, "Title exceeds maximum length of 120 characters")
      .optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
    selectedMode: chatModeSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
