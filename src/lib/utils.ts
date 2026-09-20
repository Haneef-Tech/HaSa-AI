import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function generateId(prefix = "msg"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Approximately 4 characters per token on average for English
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.33);
}

