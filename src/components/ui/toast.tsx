"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  title?: string;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: "success" | "error" | "info", title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info", title?: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 transform translate-y-0",
              t.type === "success" && "bg-slate-950/95 dark:bg-slate-900/95 border-emerald-500/40 text-slate-100",
              t.type === "error" && "bg-slate-950/95 dark:bg-slate-900/95 border-rose-500/40 text-slate-100",
              t.type === "info" && "bg-slate-950/95 dark:bg-slate-900/95 border-violet-500/40 text-slate-100"
            )}
          >
            {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
            {t.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />}
            {t.type === "info" && <Info className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />}

            <div className="flex-1 text-xs">
              {t.title && <div className="font-semibold text-slate-200 mb-0.5">{t.title}</div>}
              <div className="text-slate-300 leading-snug">{t.message}</div>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-200 p-0.5 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

