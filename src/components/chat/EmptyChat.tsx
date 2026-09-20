"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Code2, TrendingUp, GraduationCap, ArrowUpRight } from "lucide-react";
import { HasaLogo } from "@/components/branding/HasaLogo";
import { SUGGESTED_PROMPTS } from "@/lib/mock-data";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";

interface EmptyChatProps {
  onSelectPrompt: (prompt: string) => void;
}

export const EmptyChat: React.FC<EmptyChatProps> = ({ onSelectPrompt }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Sparkles":
        return <Sparkles className="w-5 h-5 text-violet-400" />;
      case "Code2":
        return <Code2 className="w-5 h-5 text-cyan-400" />;
      case "TrendingUp":
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case "GraduationCap":
        return <GraduationCap className="w-5 h-5 text-amber-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-violet-400" />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 max-w-3xl w-full mx-auto px-4 py-8 text-center select-none">
      {/* Centered Brand Mark */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.21, 1.02, 0.73, 1] }}
        className="flex flex-col items-center gap-3 mb-6"
      >
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative p-3 rounded-2xl bg-surface-elevated border border-border shadow-lg shadow-violet-950/20"
        >
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-violet-600/25 via-indigo-500/10 to-cyan-400/20 blur-xl -z-10" aria-hidden />
          <HasaLogo size={44} />
        </motion.div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Welcome to HaSa <span className="text-accent-light">AI</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md leading-relaxed">
          Your provider-agnostic AI workspace. Seamlessly orchestrating Groq, Gemini, and OpenRouter for high-speed coding, research, and analysis.
        </p>
      </motion.div>

      {/* Suggested Prompt Cards */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left mt-2">
        {SUGGESTED_PROMPTS.map((item) => (
          <StaggerItem key={item.id}>
            <motion.button
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectPrompt(item.prompt)}
              className="group relative flex flex-col justify-between w-full h-full p-4 rounded-xl border border-border bg-surface/80 backdrop-blur-sm hover:bg-surface-elevated hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-950/20 transition-colors duration-200 shadow-sm focus-ring text-left"
            >
              <div className="flex items-start justify-between gap-2 w-full mb-2">
                <div className="p-2 rounded-lg bg-surface-muted border border-border/80 group-hover:border-violet-500/30 transition-colors">
                  {getIcon(item.icon)}
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-accent-light group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>

              <div>
                <div className="text-sm font-semibold text-foreground group-hover:text-accent-light transition-colors line-clamp-1">
                  {item.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {item.description}
                </div>
              </div>
            </motion.button>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
};

