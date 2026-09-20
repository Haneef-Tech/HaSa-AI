"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, AlertCircle, RefreshCw, Cpu } from "lucide-react";
import { Message, ImportantVariant } from "@/types/chat";
import { CodeBlock } from "./CodeBlock";
import { ImportantContentCard } from "./ImportantContentCard";
import { MessageActions } from "./MessageActions";
import { formatTimestamp, cn } from "@/lib/utils";

interface AssistantMessageProps {
  message: Message;
  onRegenerate?: () => void;
  onContinue?: () => void;
}

interface ParsedBlock {
  type: "markdown" | "important";
  content: string;
  variant?: ImportantVariant;
  title?: string;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  onRegenerate,
  onContinue,
}) => {
  // Parse message content for custom :::important[...]...::: blocks
  const blocks = useMemo(() => {
    const raw = message.content || "";
    const result: ParsedBlock[] = [];
    const pattern = /:::important\[variant=(info|warning|success)(?:,title=([^\]]+))?\]\s*([\s\S]*?)\s*:::/g;

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: "markdown",
          content: raw.slice(lastIndex, match.index),
        });
      }

      result.push({
        type: "important",
        variant: (match[1] as ImportantVariant) || "info",
        title: match[2] || undefined,
        content: match[3],
      });

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < raw.length) {
      result.push({
        type: "markdown",
        content: raw.slice(lastIndex),
      });
    }

    return result;
  }, [message.content]);

  return (
    <div className="group relative w-full max-w-3xl mx-auto my-4 px-4 sm:px-6">
      {/* Provider / Model Metadata Badge */}
      <div className="flex items-center justify-between gap-2 mb-2 select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-accent/15 border border-accent/25 text-accent-light">
            <Sparkles className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-foreground tracking-tight">
              {message.provider || "HaSa AI"}
            </span>
            <span className="text-muted-foreground">•</span>
            <span
              className="text-muted-foreground font-mono text-[11px]"
              title={(message.metadata as { task?: string } | undefined)?.task ? `Task: ${(message.metadata as { task?: string }).task}` : undefined}
            >
              {message.model || "Auto Router"}
            </span>
            {message.latency && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                  {message.latency}
                </span>
              </>
            )}
            {(message.metadata as { fallbackUsed?: boolean } | undefined)?.fallbackUsed && (
              <span
                className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded"
                title="The primary model was unavailable, so a fallback model answered."
              >
                fallback
              </span>
            )}
          </div>
        </div>

        <span className="text-[10px] text-muted-foreground">
          {formatTimestamp(message.createdAt)}
        </span>
      </div>

      {/* Error state */}
      {message.error ? (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-rose-300">Model Request Failed</div>
            <div className="text-xs text-rose-300/80 mt-1">
              {message.errorMessage || "The mock provider experienced an intermittent network timeout. Please retry."}
            </div>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs font-medium text-rose-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry request
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Rendered Markdown Body */
        <div className="text-sm leading-relaxed text-foreground space-y-3 font-normal">
          {blocks.map((block, idx) => {
            if (block.type === "important") {
              return (
                <ImportantContentCard
                  key={idx}
                  variant={block.variant}
                  title={block.title}
                  content={block.content}
                />
              );
            }

            return (
              <div key={idx} className="prose prose-slate dark:prose-invert max-w-none prose-sm leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Custom Code Block rendering
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = !match && !String(children).includes("\n");

                      if (isInline) {
                        return (
                          <code
                            className="px-1.5 py-0.5 rounded-md bg-muted text-accent-light font-mono text-[12px] border border-border"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      return (
                        <CodeBlock
                          language={match ? match[1] : "text"}
                          code={String(children)}
                        />
                      );
                    },
                    // Table styling with horizontal scrolling
                    table({ children }) {
                      return (
                        <div className="my-4 overflow-x-auto rounded-xl border border-border">
                          <table className="w-full text-left text-xs sm:text-sm border-collapse">
                            {children}
                          </table>
                        </div>
                      );
                    },
                    thead({ children }) {
                      return (
                        <thead className="bg-surface-elevated border-b border-border text-xs font-semibold text-foreground">
                          {children}
                        </thead>
                      );
                    },
                    th({ children }) {
                      return <th className="px-3.5 py-2.5 font-medium">{children}</th>;
                    },
                    td({ children }) {
                      return (
                        <td className="px-3.5 py-2 border-b border-border/50 text-slate-700 dark:text-slate-300">
                          {children}
                        </td>
                      );
                    },
                    // Blockquotes
                    blockquote({ children }) {
                      return (
                        <blockquote className="border-l-2 border-accent pl-4 my-3 italic text-muted-foreground">
                          {children}
                        </blockquote>
                      );
                    },
                    // Lists
                    ul({ children }) {
                      return <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>;
                    },
                    // Headings
                    h2({ children }) {
                      return (
                        <h2 className="text-base sm:text-lg font-bold text-foreground mt-4 mb-2 tracking-tight">
                          {children}
                        </h2>
                      );
                    },
                    h3({ children }) {
                      return (
                        <h3 className="text-sm sm:text-base font-semibold text-foreground mt-3 mb-1.5 tracking-tight">
                          {children}
                        </h3>
                      );
                    },
                    p({ children }) {
                      return <p className="my-2 leading-relaxed">{children}</p>;
                    },
                  }}
                >
                  {block.content}
                </ReactMarkdown>
              </div>
            );
          })}

          {/* Streaming Cursor */}
          {message.isStreaming && (
            <span
              className="inline-block w-2 h-4 ml-1 bg-accent-light align-middle animate-blink rounded-sm"
              aria-label="Generating response..."
            />
          )}
        </div>
      )}

      {/* Assistant Actions Toolbar */}
      {!message.isStreaming && !message.error && (
        <div className="mt-3 pt-2">
          <MessageActions
            content={message.content}
            onRegenerate={onRegenerate}
            onContinue={onContinue}
            initialFeedback={message.feedback}
          />
        </div>
      )}
    </div>
  );
};

