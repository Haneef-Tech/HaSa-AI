import { z } from "zod";

export const savedItemTypeSchema = z.enum(["info", "warning", "success", "note"]);

const idSchema = z
  .string()
  .min(1, "ID is required")
  .max(128, "ID is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "ID contains invalid characters");

export const createSavedItemSchema = z.object({
  conversationId: idSchema,
  messageId: idSchema,
  title: z.string().trim().min(1, "Title cannot be empty").max(160),
  content: z.string().trim().min(1, "Content cannot be empty").max(8000),
  type: savedItemTypeSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
});

export const updateSavedItemSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    content: z.string().trim().min(1).max(8000).optional(),
    type: savedItemTypeSchema.optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateSavedItemInput = z.infer<typeof createSavedItemSchema>;
export type UpdateSavedItemInput = z.infer<typeof updateSavedItemSchema>;
