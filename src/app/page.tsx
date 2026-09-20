"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  LogOut,
  Send,
  Square,
  Bookmark,
  X,
  Loader2,
  AlertCircle,
  Menu,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { HasaWordmark } from "@/components/branding/HasaWordmark";
import { MessageList } from "@/components/chat/MessageList";
import { ConversationHeader } from "@/components/chat/ConversationHeader";
import { ModeSelector } from "@/components/composer/ModeSelector";
import { ProviderSelector, type ProviderChoice } from "@/components/composer/ProviderSelector";
import { ModelSelector } from "@/components/composer/ModelSelector";
import { fetchModels, type ApiModel } from "@/lib/api/models";
import { ProviderStatusButton } from "@/components/settings/ProviderStatusDialog";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  createConversation,
  deleteConversation,
  listConversations,
  updateConversation,
} from "@/lib/api/conversations";
import { listMessages } from "@/lib/api/messages";
import { streamChat } from "@/lib/api/chat";
import { createSavedItem, deleteSavedItem, listSavedItems } from "@/lib/api/saved-items";
import { estimateTokenCount, generateId, cn } from "@/lib/utils";
import type { ChatMode, Conversation, Message, SavedItem } from "@/types/chat";

function groupConversations(convs: Conversation[]) {
  const pinned = convs.filter((c) => c.pinned && !c.archived);
  const rest = convs.filter((c) => !c.pinned && !c.archived);
  const archived = convs.filter((c) => c.archived);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const weekAgo = startOfToday - 7 * 86_400_000;
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const week: Conversation[] = [];
  const older: Conversation[] = [];
  for (const c of rest) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= startOfToday) today.push(c);
    else if (t >= startOfYesterday) yesterday.push(c);
    else if (t >= weekAgo) week.push(c);
    else older.push(c);
  }
  return { pinned, today, yesterday, week, older, archived };
}

function extractImportantBlocks(content: string): Array<{ variant: string; title?: string; content: string }> {
  const out: Array<{ variant: string; title?: string; content: string }> = [];
  const pattern = /:::important\[variant=(info|warning|success)(?:,title=([^\]]+))?\]\s*([\s\S]*?)\s*:::/g;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    out.push({ variant: m[1], title: m[2] || undefined, content: m[3].trim().slice(0, 2000) });
  }
  return out;
}

export default function HomePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<ChatMode>("auto");
  /** Provider-only selection — the user picks one of four providers (Groq default). */
  const [provider, setProvider] = useState<ProviderChoice>("groq");
  /** Manual model pin inside the provider (null = Auto router picks). */
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [models, setModels] = useState<ApiModel[]>([]);
  const [streamPhase, setStreamPhase] = useState<{ phase: "idle" | "connecting" | "streaming"; provider?: string }>({ phase: "idle" });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [toast, setToast] = useState<{ title: string; description?: string; variant?: "success" | "error" | "info" } | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const abortRef = useRef<{ abort: () => void } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Switch-restart bookkeeping: last prompt + live refs so a provider/model
  // change mid-stream can STOP the old answer and re-answer with full context.
  const lastUserTextRef = useRef<string>("");
  const lastConvIdRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const providerRef = useRef<ProviderChoice>("groq");
  const modelRef = useRef<string | null>(null);
  const modeRef = useRef<ChatMode>("auto");
  // Restart serialization: only the latest switch-restart may stream; stale
  // ones exit without touching flags. activeGen guards flag cleanup so an
  // aborted (older) run can never clobber a newer run's streaming state.
  const restartSeqRef = useRef(0);
  const activeGenRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const releaseStreamIfCurrent = (gen: number) => {
    if (activeGenRef.current === gen) {
      setStreaming(false);
      setStreamPhase({ phase: "idle" });
      abortRef.current = null;
    }
  };
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);
  useEffect(() => { providerRef.current = provider; }, [provider]);
  useEffect(() => { modelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const showToast = useCallback((t: NonNullable<typeof toast>) => {
    setToast(t);
    setTimeout(() => setToast(null), 4200);
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const convs = await listConversations();
      setConversations(convs);
      return convs;
    } catch (err) {
      showToast({ title: "Could not load conversations", description: (err as Error).message, variant: "error" });
      return [];
    }
  }, [showToast]);

  const refreshSaved = useCallback(async () => {
    try {
      setSavedItems(await listSavedItems());
    } catch {
      // Non-fatal; saved panel will show empty state.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingConvs(true);
      const convs = await refreshConversations();
      await refreshSaved();
      try {
        setModels(await fetchModels());
      } catch {
        // Non-fatal; provider switching still works, model list just hides.
      }
      setLoadingConvs(false);
      if (!activeId && convs.length > 0) setActiveId(convs[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  useEffect(() => {
    if (activeConversation) setMode(activeConversation.selectedMode ?? "auto");
  }, [activeConversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMsgs(true);
    setChatError(null);
    try {
      const { messages: msgs } = await listMessages(conversationId, { limit: 100 });
      setMessages(msgs);
    } catch (err) {
      setChatError((err as Error).message ?? "Could not load messages.");
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  const handleNewChat = async () => {
    setDrawerOpen(false);
    try {
      const conv = await createConversation({ title: "New conversation", selectedMode: mode });
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
      setInput("");
      textareaRef.current?.focus();
    } catch (err) {
      showToast({ title: "Could not create conversation", description: (err as Error).message, variant: "error" });
    }
  };

  /**
   * Race 409s (duplicate-generation guard) and momentary 429s are worth ONE
   * silent retry after the server-indicated delay. Anything slower (real
   * per-minute rate limits) surfaces as an error instead.
   */
  const isQuickRetryable = (err: { code: string; retryAfterMs?: number }) =>
    err.code === "CONFLICT" ||
    (err.code === "RATE_LIMITED" && (err.retryAfterMs ?? Number.POSITIVE_INFINITY) <= 8000);

  /**
   * Core assistant streaming routine. `appendUser` controls whether a new user
   * bubble is added (normal send) or reused (provider/model switch-restart —
   * keeps a single user message so context quality + reasoning are preserved).
   * Returns a generation id for guarded flag cleanup. Holds the streaming
   * flags until the FINAL attempt settles (including one silent quick-retry
   * that reuses the same placeholder).
   */
  const runAssistantStream = async (
    conversationId: string,
    text: string,
    opts: { providerChoice: ProviderChoice; modelChoice: string | null; modeValue: ChatMode; appendUser: boolean }
  ): Promise<number> => {
    const gen = ++activeGenRef.current;
    if (opts.appendUser) {
      const userMsg: Message = {
        id: generateId("msg"),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }
    const placeholderId = generateId("msg");
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        provider: "Selecting model…",
        model: opts.modelChoice ?? opts.providerChoice,
        mode: opts.modeValue,
        isStreaming: true,
      },
    ]);
    setStreaming(true);
    setStreamPhase({ phase: "connecting" });

    const payload = {
      conversationId,
      message: text,
      mode: opts.modeValue,
      requestedProvider: opts.providerChoice,
      ...(opts.modelChoice ? { requestedModel: opts.modelChoice } : {}),
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      // Object holder (not a plain union local) so mutations inside the
      // stream callbacks stay visible to control flow below.
      const state: { outcome: "done" | "retry" | "failed"; retryAfterMs: number } = {
        outcome: "done",
        retryAfterMs: 1500,
      };
      const { abort } = await streamChat(payload, {
        onMetadata: (meta) => {
          setStreamPhase({ phase: "connecting", provider: meta.provider });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId ? { ...m, provider: meta.provider, model: meta.model } : m
            )
          );
        },
        onToken: (_delta, accumulated) => {
          setStreamPhase((s) => (s.phase === "streaming" ? s : { ...s, phase: "streaming" }));
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...m, content: accumulated } : m))
          );
        },
        onComplete: (e) => {
          setStreamPhase({ phase: "idle" });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? { ...e.message, feedback: null }
                : m
            )
          );
          if (e.fallbackUsed) {
            showToast({
              title: "Fallback used",
              description: `Primary model was unavailable — answered with ${e.provider}.`,
              variant: "info",
            });
          }
          refreshConversations();
        },
        onError: (err) => {
          // Abort-driven restarts surface as errors — the restart path clears
          // the placeholder itself, so only handle genuine failures here.
          if ((err.code === "STREAM_INTERRUPTED" || err.code === "ABORTED") && streamingRef.current) return;
          if (isQuickRetryable(err) && attempt === 0 && !stopRequestedRef.current) {
            state.outcome = "retry";
            state.retryAfterMs = Math.min(Math.max(err.retryAfterMs ?? 1500, 500), 6000);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId ? { ...m, provider: "Retrying…", model: opts.modelChoice ?? opts.providerChoice } : m
              )
            );
            return;
          }
          state.outcome = "failed";
          setStreamPhase({ phase: "idle" });
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          setChatError(err.retryable ? `${err.message} You can retry.` : err.message);
          showToast({ title: "Chat request failed", description: err.message, variant: "error" });
        },
      });
      // Never clobber a newer generation's abort handle.
      if (activeGenRef.current === gen) abortRef.current = { abort };
      if (state.outcome !== "retry") break;
      // Stale generation (a newer switch already took over) or user Stop:
      // never restart, never touch flags owned by someone else.
      if (activeGenRef.current !== gen || stopRequestedRef.current) break;
      await new Promise((r) => setTimeout(r, state.retryAfterMs));
      if (activeGenRef.current !== gen || stopRequestedRef.current) break;
      setStreamPhase({ phase: "connecting" });
    }
    return gen;
  };

  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || streamingRef.current) return;
    setChatError(null);
    let conversationId = activeId;
    try {
      if (!conversationId) {
        const conv = await createConversation({
          title: text.slice(0, 60) || "New conversation",
          selectedMode: mode,
        });
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
        conversationId = conv.id;
      }
      lastUserTextRef.current = text;
      lastConvIdRef.current = conversationId as string;
      stopRequestedRef.current = false;
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      const gen = await runAssistantStream(conversationId as string, text, {
        providerChoice: providerRef.current,
        modelChoice: modelRef.current,
        modeValue: modeRef.current,
        appendUser: true,
      });
      releaseStreamIfCurrent(gen);
    } catch (err) {
      setChatError((err as Error).message ?? "Chat request failed.");
      setStreaming(false);
      setStreamPhase({ phase: "idle" });
      abortRef.current = null;
    }
  };

  /**
   * Model/provider/mode switch during streaming: STOP the in-flight answer
   * immediately, discard its partial output, then re-answer the SAME prompt
   * with the new selection once (full conversation history + task reasoning
   * are rebuilt server-side, so quality is maintained).
   */
  const restartWithSelection = async (
    next: { providerChoice: ProviderChoice; modelChoice: string | null; modeValue: ChatMode },
    label: string
  ) => {
    // Serialize: only the latest switch wins; stale restarts exit quietly.
    const mySeq = ++restartSeqRef.current;
    if (!streamingRef.current || !lastUserTextRef.current || !lastConvIdRef.current) return;
    stopRequestedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    // Drop the partial assistant bubble from the old model.
    setMessages((prev) => prev.filter((m) => !m.isStreaming));
    setStreamPhase({ phase: "connecting", provider: label });
    // Let the server release its in-flight guard before the new stream starts
    // (eager server-side release + 409 auto-retry cover the residual race).
    await new Promise((r) => setTimeout(r, 900));
    // Superseded by a newer switch, stopped by the user, or conversation gone:
    // never restart, never touch flags owned by someone else.
    if (mySeq !== restartSeqRef.current || stopRequestedRef.current) return;
    if (!lastUserTextRef.current || !lastConvIdRef.current) return;
    const convId = lastConvIdRef.current;
    const prompt = lastUserTextRef.current;
    setStreaming(true);
    try {
      const gen = await runAssistantStream(convId, prompt, {
        providerChoice: next.providerChoice,
        modelChoice: next.modelChoice,
        modeValue: next.modeValue,
        appendUser: false,
      });
      if (mySeq === restartSeqRef.current) releaseStreamIfCurrent(gen);
    } catch (err) {
      if (mySeq !== restartSeqRef.current || stopRequestedRef.current) return;
      setChatError((err as Error).message ?? "Chat request failed.");
      setStreaming(false);
      setStreamPhase({ phase: "idle" });
      abortRef.current = null;
    }
  };

  const handleProviderSwitch = (next: ProviderChoice) => {
    if (next === providerRef.current) return;
    setProvider(next);
    // Changing provider resets any manual model pin from another provider.
    setSelectedModel(null);
    if (streamingRef.current) {
      showToast({ title: `Switched to ${next}`, description: "Stopped previous answer — re-answering with full context.", variant: "info" });
      void restartWithSelection({ providerChoice: next, modelChoice: null, modeValue: modeRef.current }, next);
    }
  };

  const handleModelSwitch = (modelId: string | null) => {
    if (modelId === modelRef.current) return;
    setSelectedModel(modelId);
    const model = modelId ? models.find((m) => m.id === modelId) : null;
    // Keep provider in sync when a manual model from another provider is picked.
    const nextProvider = model ? (model.provider as ProviderChoice) : providerRef.current;
    if (model && nextProvider !== providerRef.current) setProvider(nextProvider);
    if (streamingRef.current) {
      showToast({
        title: model ? `Switched to ${model.displayName}` : "Switched to Auto",
        description: "Stopped previous answer — re-answering with full context.",
        variant: "info",
      });
      void restartWithSelection(
        { providerChoice: nextProvider, modelChoice: modelId, modeValue: modeRef.current },
        model?.displayName ?? "Auto"
      );
    }
  };

  const handleModeSwitch = (next: ChatMode) => {
    if (next === modeRef.current) {
      setMode(next);
      return;
    }
    setMode(next);
    if (streamingRef.current) {
      showToast({ title: `Mode: ${next}`, description: "Stopped previous answer — re-answering with full context.", variant: "info" });
      void restartWithSelection(
        { providerChoice: providerRef.current, modelChoice: modelRef.current, modeValue: next },
        next
      );
    }
  };

  const handleStop = () => {
    // Invalidate any pending switch-restart and in-flight generation so
    // nothing can resurrect streaming after the user asked to stop.
    stopRequestedRef.current = true;
    restartSeqRef.current++;
    activeGenRef.current++;
    lastUserTextRef.current = "";
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamPhase({ phase: "idle" });
    setMessages((prev) => prev.filter((m) => !m.isStreaming || (m.content && m.content.length > 0)));
  };

  const handleSaveHighlights = async (assistantMessage: Message) => {
    const blocks = extractImportantBlocks(assistantMessage.content);
    if (blocks.length === 0) {
      showToast({ title: "No highlights found", description: "This response has no important callouts to save.", variant: "info" });
      return;
    }
    try {
      for (const b of blocks) {
        await createSavedItem({
          conversationId: activeId as string,
          messageId: assistantMessage.id,
          title: b.title ?? `${b.variant} note`,
          content: b.content,
          type: (["info", "warning", "success"].includes(b.variant) ? b.variant : "note") as SavedItem["type"],
          tags: ["highlight"],
        });
      }
      await refreshSaved();
      showToast({ title: `Saved ${blocks.length} highlight${blocks.length > 1 ? "s" : ""}`, variant: "success" });
    } catch (err) {
      showToast({ title: "Could not save highlights", description: (err as Error).message, variant: "error" });
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || c.lastMessagePreview?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  if (authLoading || (!user && typeof window !== "undefined")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent-light" />
      </div>
    );
  }

  const renderConvButton = (c: Conversation) => (
    <button
      key={c.id}
      onClick={() => {
        setActiveId(c.id);
        setDrawerOpen(false);
      }}
      className={cn(
        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate",
        c.id === activeId
          ? "bg-sidebar-active text-foreground border border-border"
          : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
      )}
      title={c.title}
    >
      <span className="block truncate">{c.title}</span>
      {c.lastMessagePreview && (
        <span className="block truncate text-[11px] text-muted-foreground/70 mt-0.5">
          {c.lastMessagePreview.slice(0, 60)}
        </span>
      )}
    </button>
  );

  const tokenEstimate = estimateTokenCount(input);

  return (
    <div className="h-dvh flex bg-background text-foreground overflow-hidden ambient-bg">
      {/* Mobile backdrop */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>
      {/* Sidebar — slide-over drawer on mobile, collapsible rail on desktop */}
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar shrink-0",
          "fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[300px] shadow-2xl transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:h-dvh md:w-72 md:max-w-none md:shadow-none md:translate-x-0",
          sidebarOpen ? "md:flex" : "md:hidden"
        )}
        aria-label="Conversation history"
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
          <HasaWordmark />
          <div className="flex-1" />
          <button
            onClick={() => setDrawerOpen(false)}
            className="md:hidden p-2 -mr-1 rounded-lg text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
          <div className="p-3 space-y-2">
            <button
              onClick={handleNewChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
            >
              <Plus className="w-4 h-4" /> New chat
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full bg-transparent py-2 text-sm focus:outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">
            {loadingConvs ? (
              <div className="space-y-3 px-1 py-2" aria-label="Loading conversations">
                {[92, 76, 84, 64, 80].map((w, i) => (
                  <div key={i}>
                    <div className="skeleton h-4 mb-1.5" style={{ width: `${w}%` }} />
                    <div className="skeleton h-3" style={{ width: `${Math.max(w - 22, 30)}%` }} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {groups.pinned.length > 0 && (
                  <div>
                    <div className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pinned</div>
                    <div className="space-y-1">{groups.pinned.map(renderConvButton)}</div>
                  </div>
                )}
                {(
                  [
                    ["Today", groups.today],
                    ["Yesterday", groups.yesterday],
                    ["Previous 7 days", groups.week],
                    ["Older", groups.older],
                  ] as Array<[string, Conversation[]]>
                ).map(([label, list]) =>
                  list.length > 0 ? (
                    <div key={label}>
                      <div className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                      <div className="space-y-1">{list.map(renderConvButton)}</div>
                    </div>
                  ) : null
                )}
                {groups.archived.length > 0 && (
                  <div>
                    <div className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Archived</div>
                    <div className="space-y-1">{groups.archived.map(renderConvButton)}</div>
                  </div>
                )}
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1 py-4">No conversations yet. Start a new chat.</p>
                )}
              </>
            )}
          </div>
          <div className="border-t border-sidebar-border p-3 space-y-2">
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
            >
              <Bookmark className="w-3.5 h-3.5" /> Saved highlights ({savedItems.length})
            </button>
            <ProviderStatusButton className="w-full justify-start px-3 py-2" />
            <div className="flex items-center gap-2 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-light">
                {(user?.email?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs font-medium">{user?.email}</div>
              </div>
              <button
                onClick={() => signOut().then(() => router.replace("/login"))}
                className="p-2 rounded-lg text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-border bg-surface/60 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 h-14">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground md:hidden shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground hidden md:block shrink-0"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="md:hidden flex items-center min-w-0">
              <HasaWordmark size="sm" />
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
              <div className="hidden sm:block min-w-0">
                <ModelSelector models={models} value={selectedModel} onSelect={handleModelSwitch} />
              </div>
              <ModeSelector currentMode={mode} onSelectMode={handleModeSwitch} placement="top" />
              <ThemeToggle />
            </div>
          </div>
        </div>

        <ConversationHeader
          conversation={activeConversation}
          mode={mode}
          isStreaming={streaming}
          onRename={async (newTitle) => {
            if (!activeId) return;
            try {
              const updated = await updateConversation(activeId, { title: newTitle });
              setConversations((prev) => prev.map((c) => (c.id === activeId ? updated : c)));
            } catch (err) {
              showToast({ title: "Rename failed", description: (err as Error).message, variant: "error" });
            }
          }}
          onTogglePin={async () => {
            if (!activeId || !activeConversation) return;
            try {
              const updated = await updateConversation(activeId, { pinned: !activeConversation.pinned });
              setConversations((prev) => prev.map((c) => (c.id === activeId ? updated : c)));
            } catch (err) {
              showToast({ title: "Pin failed", description: (err as Error).message, variant: "error" });
            }
          }}
          onDelete={async () => {
            if (!activeId) return;
            if (!confirm("Delete this conversation and all its messages?")) return;
            try {
              await deleteConversation(activeId);
              setConversations((prev) => prev.filter((c) => c.id !== activeId));
              setActiveId(null);
              setMessages([]);
            } catch (err) {
              showToast({ title: "Delete failed", description: (err as Error).message, variant: "error" });
            }
          }}
          onExport={() => {
            const blob = new Blob([messages.map((m) => `## ${m.role}\n\n${m.content}`).join("\n\n---\n\n")], {
              type: "text/markdown",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${activeConversation?.title ?? "hasa-chat"}.md`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        />

        {activeConversation && (
          <div className="flex items-center gap-2 px-4 sm:px-6 py-2 border-b border-border/50 text-[11px] text-muted-foreground">
            <button
              onClick={async () => {
                try {
                  const updated = await updateConversation(activeConversation.id, {
                    archived: !activeConversation.archived,
                  });
                  setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                } catch (err) {
                  showToast({ title: "Archive failed", description: (err as Error).message, variant: "error" });
                }
              }}
              className="flex items-center gap-1 hover:text-foreground"
            >
              {activeConversation.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {activeConversation.archived ? "Unarchive" : "Archive"}
            </button>
            <span>•</span>
            <span>{activeConversation.messageCount} messages</span>
            <span>•</span>
            <span className="font-mono">
              {[...messages].reverse().find((m) => m.role === "assistant" && m.provider)?.provider ??
                "auto router"}
            </span>
          </div>
        )}

        <AnimatePresence>
          {chatError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-4 sm:mx-6 mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2.5 text-sm text-rose-200"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="flex-1">{chatError}</span>
              <button onClick={() => setChatError(null)} aria-label="Dismiss error">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            {loadingMsgs ? (
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6" aria-label="Loading messages">
                <div className="max-w-3xl mx-auto space-y-5">
                  <div className="flex justify-end"><div className="skeleton h-12 w-2/3" /></div>
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-24 w-full" />
                  <div className="flex justify-end"><div className="skeleton h-10 w-1/2" /></div>
                  <div className="skeleton h-4 w-1/4" />
                  <div className="skeleton h-32 w-full" />
                </div>
              </div>
            ) : (
              <MessageList
                messages={messages}
                isStreaming={streaming}
                onSelectPrompt={(p) => handleSend(p)}
                onRegenerateAssistant={(messageId) => {
                  const idx = messages.findIndex((m) => m.id === messageId);
                  const prevUser = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
                  if (prevUser) handleSend(prevUser.content);
                }}
              />
            )}

            {/* Save-highlights shortcut for latest assistant message */}
            {(() => {
              const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.isStreaming && m.content.includes(":::important"));
              if (!lastAssistant) return null;
              return (
                <div className="px-4 sm:px-6 pb-1">
                  <button
                    onClick={() => handleSaveHighlights(lastAssistant)}
                    className="flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Save highlights from latest response
                  </button>
                </div>
              );
            })()}

            {/* Composer */}
            <div className="border-t border-border bg-surface/60 backdrop-blur-md px-3 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-surface p-2 shadow-sm transition-all duration-200 focus-within:border-violet-500/60 focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_8px_30px_-12px_rgba(124,58,237,0.45)]">
                  <div className="flex flex-col gap-1 shrink-0">
                    <ProviderSelector value={provider} onSelect={handleProviderSwitch} />
                    {models.length > 0 && (
                      <div className="sm:hidden">
                        <ModelSelector models={models} value={selectedModel} onSelect={handleModelSwitch} />
                      </div>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    placeholder={activeId ? "Message HaSa AI… (Enter to send)" : "Start a new conversation…"}
                    className="flex-1 bg-transparent px-2 py-2 text-sm focus:outline-none resize-none max-h-[200px] placeholder:text-muted-foreground"
                  />
                  <span className="hidden sm:block text-[10px] font-mono text-muted-foreground pb-2">
                    ~{tokenEstimate} tokens
                  </span>
                  {streaming ? (
                    <button
                      onClick={handleStop}
                      className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors shrink-0"
                      aria-label="Stop generating"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  ) : (
                    <motion.button
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      whileTap={{ scale: 0.9 }}
                      className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-950/40 hover:from-violet-400 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-900/40 transition-all disabled:opacity-40 disabled:shadow-none disabled:hover:from-violet-500 disabled:hover:to-indigo-600 shrink-0"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="truncate">
                    {streaming
                      ? streamPhase.phase === "streaming"
                        ? `Streaming${streamPhase.provider ? ` from ${streamPhase.provider}` : ""}…`
                        : `Selecting model${streamPhase.provider ? ` · ${streamPhase.provider}` : ""}…`
                      : "Free-tier routing · Groq · Gemini · OpenRouter · Nara"}
                  </span>
                  <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {activeConversation?.pinned ? <Pin className="w-3 h-3 text-accent-light" /> : <PinOff className="w-3 h-3 opacity-40" />}
                    <span className="truncate max-w-[180px]">{user?.email}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Saved panel — overlay sheet on mobile/tablet, side rail on desktop */}
          {showSaved && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSaved(false)}
                aria-hidden
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 36 }}
                className="fixed inset-y-0 right-0 z-40 w-[86vw] max-w-[320px] border-l border-border bg-surface overflow-y-auto p-4 shadow-2xl lg:static lg:z-auto lg:w-72 lg:max-w-none lg:shrink-0 lg:shadow-none lg:transform-none">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Saved highlights</h3>
                  <button
                    onClick={() => setShowSaved(false)}
                    aria-label="Close saved panel"
                    className="p-1.5 -mr-1 rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              {savedItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved items yet. Save callouts from assistant responses.</p>
              ) : (
                <div className="space-y-2">
                  {savedItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-surface-muted p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-semibold truncate">{item.title}</div>
                        <button
                          onClick={async () => {
                            await deleteSavedItem(item.id);
                            setSavedItems((prev) => prev.filter((s) => s.id !== item.id));
                          }}
                          aria-label="Delete saved item"
                          className="text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 line-clamp-4">{item.content}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border">{item.type}</span>
                        {item.tags.map((t) => (
                          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">#{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </motion.aside>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.21, 1.02, 0.73, 1] }}
            className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm z-50 rounded-xl border border-border bg-surface-elevated p-3.5 shadow-2xl"
          >
            <div className="text-xs font-semibold">{toast.title}</div>
            {toast.description && <div className="text-xs text-muted-foreground mt-0.5">{toast.description}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
