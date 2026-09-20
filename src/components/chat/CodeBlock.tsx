"use client";

import React, { useState } from "react";
import { Check, Copy, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface CodeBlockProps {
  language?: string;
  code: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  language = "text",
  code,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(false);

  // Normalize code string
  const cleanCode = code.replace(/\n$/, "");
  const lines = cleanCode.split("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  return (
    <div
      className={cn(
        "my-4 rounded-xl border border-border bg-[#0d1017] dark:bg-[#0b0e14] overflow-hidden shadow-sm transition-all duration-150 group",
        className
      )}
    >
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#121620] dark:bg-[#0f131c] border-b border-border/80 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-medium tracking-wider uppercase text-slate-400">
            {language}
          </span>
          <span className="text-[10px] text-slate-600 dark:text-slate-500">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip content={showLineNumbers ? "Hide line numbers" : "Show line numbers"}>
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={cn(
                "p-1 rounded-md text-xs transition-colors focus-ring",
                showLineNumbers
                  ? "text-violet-400 bg-violet-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
              aria-label="Toggle line numbers"
            >
              <Hash className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content={copied ? "Copied to clipboard!" : "Copy code"}>
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors focus-ring",
                copied
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
              aria-label={`Copy ${language} code`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Code Content Area with Horizontal Scroll */}
      <div className="overflow-x-auto p-4 text-xs sm:text-sm font-mono leading-relaxed text-slate-200 selection:bg-violet-900/60 selection:text-white">
        <pre className="m-0 p-0 font-mono">
          <code>
            {lines.map((line, idx) => (
              <div key={idx} className="table-row group/line hover:bg-slate-800/30">
                {showLineNumbers && (
                  <span className="table-cell select-none pr-4 text-right text-slate-600 dark:text-slate-500 text-xs w-8">
                    {idx + 1}
                  </span>
                )}
                <span className="table-cell whitespace-pre">{line || " "}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

