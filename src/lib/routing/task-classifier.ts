/**
 * Deterministic task classifier — no LLM calls, no latency, no cost.
 * Rule order matters: structured-output and long-context are checked from
 * explicit markers first; reasoning before coding (a proof about an algorithm
 * is reasoning, not a coding task); confidence is signal-count based and
 * anything weak collapses to "general".
 */

export type TaskType =
  | "general"
  | "coding"
  | "reasoning"
  | "summarization"
  | "creative"
  | "structured-output"
  | "long-context";

export interface TaskClassification {
  task: TaskType;
  confidence: number;
  /** Matched signal labels — development logging only, never user-facing. */
  signals: string[];
}

/** Pasted-text threshold (chars) for the long-context signal. */
export const LONG_CONTEXT_CHARS = 6000;

const SIGNAL_SETS: Array<{ task: Exclude<TaskType, "general">; signals: string[] }> = [
  {
    task: "structured-output",
    signals: ["json", "schema", "table", "csv", "return only", "structured format", "as a list", "markdown table"],
  },
  {
    task: "coding",
    signals: ["python", "javascript", "typescript", "sql", "api", "function", "bug", "error", "debug", "code", "react", "next.js", "git", "refactor", "compile", "stack trace", "exception", "npm", "pip", "docker"],
  },
  {
    task: "reasoning",
    signals: ["compare", "evaluate", "why", "trade-off", "tradeoff", "plan", "analyze", "architecture", "strategy", "solve", "prove", "proof", "theorem", "pros and cons"],
  },
  {
    task: "summarization",
    signals: ["summarize", "summary", "tl;dr", "tldr", "key points", "condense", "explain this document briefly", "in short"],
  },
  {
    task: "creative",
    signals: ["write", "story", "slogan", "brainstorm", "design", "generate ideas", "marketing copy", "poem", "tagline", "essay"],
  },
];

const TASK_CAPABILITY: Record<TaskType, string> = {
  general: "general",
  coding: "coding",
  reasoning: "reasoning",
  summarization: "summarization",
  creative: "creative",
  "structured-output": "structured-output",
  "long-context": "long-context",
};

export function requiredCapability(task: TaskType): string {
  return TASK_CAPABILITY[task];
}

export function classifyTask(text: string): TaskClassification {
  const lower = text.toLowerCase();
  const hits: Array<{ task: Exclude<TaskType, "general">; signal: string }> = [];

  if (text.length >= LONG_CONTEXT_CHARS) {
    return { task: "long-context", confidence: 0.9, signals: [`pasted-text:${text.length}-chars`] };
  }
  if (/(document|transcript|article|paper)( attached| below| pasted)?/i.test(text) && text.length >= 1500) {
    return { task: "long-context", confidence: 0.75, signals: ["document-marker+length"] };
  }
  // Multiple paragraphs of pasted content.
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 4 && text.length >= 2500) {
    return { task: "long-context", confidence: 0.7, signals: [`${paragraphs.length}-paragraphs`] };
  }

  for (const set of SIGNAL_SETS) {
    for (const signal of set.signals) {
      if (lower.includes(signal)) hits.push({ task: set.task, signal });
    }
  }
  if (hits.length === 0) return { task: "general", confidence: 0.4, signals: [] };

  // Priority order = SIGNAL_SETS order (structured > coding > reasoning > summary > creative).
  const winner = hits[0];
  const support = hits.filter((h) => h.task === winner.task).length;
  const confidence = Math.min(0.55 + support * 0.12, 0.95);
  return {
    task: winner.task,
    confidence,
    signals: hits.filter((h) => h.task === winner.task).map((h) => h.signal),
  };
}
