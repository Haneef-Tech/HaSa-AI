"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  MessagesSquare,
  Mail,
  HardDrive,
  Trash2,
  Eye,
  Send,
  LogOut,
  Loader2,
  AlertTriangle,
  Search,
  X,
  ShieldCheck,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { HasaLogo } from "@/components/branding/HasaLogo";
import { AnimatedCounter, FadeUp, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

type Tab = "users" | "conversations" | "email" | "storage" | "api";

interface ProviderApiState {
  hasKey: boolean;
  fromAdmin: boolean;
  source?: "admin" | "env" | "none";
  envHasKey?: boolean;
  maskedHint?: string;
  models: string[];
  baseUrl?: string | null;
}

interface AdminUser {
  uid: string;
  email: string | null;
  disabled: boolean;
  createdAt: string;
  lastSignIn: string | null;
  conversations: number;
  savedItems: number;
}

interface ConvSummary {
  id: string;
  title: string;
  updatedAt: string;
  selectedMode: string;
  messageCount: number;
  lastMessagePreview: string | null;
  pinned: boolean;
  archived: boolean;
}

interface TranscriptMsg {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  provider: string | null;
  model: string | null;
}

interface StorageStats {
  totals: { users: number; conversations: number; messages: number; savedItems: number; usageRecords?: number };
  quota?: { bytes: number; usedBytes: number; availableBytes: number; plan: string };
  collections?: Array<{ name: string; docs: number; estimatedBytes: number }>;
  users: Array<{
    uid: string;
    email: string | null;
    conversations: number;
    messages: number;
    savedItems: number;
    usageRecords?: number;
    estimatedBytes: number;
  }>;
  note: string;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  return data as T;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminDashboard() {
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("users");
  const [backendDown, setBackendDown] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const [convUid, setConvUid] = useState("");
  const [convs, setConvs] = useState<ConvSummary[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [openConv, setOpenConv] = useState<{ title: string; messages: TranscriptMsg[] } | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [broadcast, setBroadcast] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);

  const [apiConfig, setApiConfig] = useState<Record<string, ProviderApiState> | null>(null);
  const [apiFirestore, setApiFirestore] = useState<boolean>(false);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiDraft, setApiDraft] = useState<Record<string, { key: string; models: string; baseUrl: string }>>({});
  const [savingApi, setSavingApi] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [keyTest, setKeyTest] = useState<Record<string, { ok: boolean; message: string }>>({});

  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const flash = useCallback((kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 4500);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await api<{ email: string }>("/api/admin/session");
        setAdminEmail(me.email);
      } catch {
        setGateError("Admin session required.");
        router.replace("/admin/login");
      }
    })();
  }, [router]);

  const loadUsers = useCallback(async (pageToken?: string | null) => {
    setLoadingUsers(true);
    setBackendDown(false);
    try {
      const data = await api<{ users: AdminUser[]; nextPageToken: string | null }>(
        `/api/admin/users?limit=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`
      );
      setUsers(pageToken ? (prev) => [...prev, ...data.users] : data.users);
      setNextToken(data.nextPageToken);
    } catch (err) {
      setBackendDown(true);
      flash("err", err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoadingUsers(false);
    }
  }, [flash]);

  useEffect(() => {
    if (adminEmail) {
      void loadUsers(null);
      void api<{ configured: boolean }>("/api/admin/email")
        .then((r) => setEmailConfigured(r.configured))
        .catch(() => setEmailConfigured(false));
    }
  }, [adminEmail, loadUsers]);

  const deleteUser = async (uid: string, email: string | null) => {
    if (!confirm(`Permanently delete ${email ?? uid} and ALL of their data? This cannot be undone.`)) return;
    setBusyUid(uid);
    try {
      await api(`/api/admin/users/${encodeURIComponent(uid)}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      flash("ok", `Deleted ${email ?? uid}.`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyUid(null);
    }
  };

  const loadConvs = async (uid: string) => {
    const id = uid.trim();
    if (!id) return;
    setLoadingConvs(true);
    try {
      const data = await api<{ conversations: ConvSummary[] }>(
        `/api/admin/users/${encodeURIComponent(id)}/conversations`
      );
      setConvs(data.conversations);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Could not load conversations.");
      setConvs([]);
    } finally {
      setLoadingConvs(false);
    }
  };

  const openTranscript = async (uid: string, cid: string, title: string) => {
    setLoadingTranscript(true);
    try {
      const data = await api<{ messages: TranscriptMsg[] }>(
        `/api/admin/users/${encodeURIComponent(uid)}/conversations/${encodeURIComponent(cid)}`
      );
      setOpenConv({ title, messages: data.messages });
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Could not load transcript.");
    } finally {
      setLoadingTranscript(false);
    }
  };

  const deleteConv = async (uid: string, cid: string, title: string) => {
    if (!confirm(`Delete conversation "${title}" and all its messages?`)) return;
    try {
      await api(`/api/admin/users/${encodeURIComponent(uid)}/conversations/${encodeURIComponent(cid)}`, {
        method: "DELETE",
      });
      setConvs((prev) => prev.filter((c) => c.id !== cid));
      flash("ok", "Conversation deleted.");
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailResult(null);
    setSending(true);
    try {
      const data = await api<{ sent: number; failed: string[]; total: number }>("/api/admin/email", {
        method: "POST",
        body: JSON.stringify({ to: broadcast ? undefined : to, broadcast, subject, body }),
      });
      setEmailResult(
        `Sent ${data.sent}/${data.total}.${data.failed.length ? ` Failed: ${data.failed.join(", ")}` : ""}`
      );
      if (!data.failed.length) {
        setTo("");
        setSubject("");
        setBody("");
      }
    } catch (err) {
      setEmailResult(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  };

  const loadStorage = useCallback(async () => {
    setLoadingStorage(true);
    try {
      setStorage(await api<StorageStats>("/api/admin/storage"));
    } catch (err) {
      setBackendDown(true);
      flash("err", err instanceof Error ? err.message : "Could not load storage stats.");
    } finally {
      setLoadingStorage(false);
    }
  }, [flash]);

  useEffect(() => {
    if (adminEmail && tab === "storage" && !storage) void loadStorage();
  }, [adminEmail, tab, storage, loadStorage]);

  const loadApiConfig = useCallback(async () => {
    setLoadingApi(true);
    try {
      const data = await api<{
        providers: Record<string, ProviderApiState>;
        firestoreBacked: boolean;
      }>("/api/admin/api-config");
      setApiConfig(data.providers);
      setApiFirestore(data.firestoreBacked);
      setApiDraft((prev) => {
        const next = { ...prev };
        for (const [id, p] of Object.entries(data.providers)) {
          next[id] = {
            key: "",
            models: (p.models ?? []).join(", "),
            baseUrl: p.baseUrl ?? "",
          };
        }
        return next;
      });
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Could not load API config.");
    } finally {
      setLoadingApi(false);
    }
  }, [flash]);

  useEffect(() => {
    if (adminEmail && tab === "api" && !apiConfig) void loadApiConfig();
  }, [adminEmail, tab, apiConfig, loadApiConfig]);

  const saveApiConfig = async () => {
    setSavingApi(true);
    try {
      const providers: Record<string, Record<string, unknown>> = {};
      for (const [id, draft] of Object.entries(apiDraft)) {
        const patch: Record<string, unknown> = {};
        if (draft.key.trim()) patch.apiKey = draft.key.trim();
        // Models/baseUrl are always sent (empty clears the override).
        patch.models = draft.models.split(",").map((m) => m.trim()).filter(Boolean);
        if (id === "narorouter") patch.baseUrl = draft.baseUrl.trim();
        providers[id] = patch;
      }
      const data = await api<{
        providers: Record<string, ProviderApiState>;
        warnings?: string[];
        health?: Record<string, { available: boolean; reason?: string }>;
      }>("/api/admin/api-config", { method: "PUT", body: JSON.stringify({ providers }) });
      setApiConfig(data.providers);
      setApiDraft((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(providers)) next[id] = { ...next[id], key: "" };
        return next;
      });
      const healthNote = data.health
        ? ` Live check: ${Object.entries(data.health).map(([k, v]) => `${k} ${v.available ? "✓" : "✗"}`).join(", ")}.`
        : "";
      flash("ok", data.warnings?.length ? `Saved with warnings: ${data.warnings.join(" ")}${healthNote}` : `Keys + models saved to Firestore + .env.local. Chat uses them immediately.${healthNote}`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingApi(false);
    }
  };

  const testProviderKey = async (id: string) => {
    const draft = apiDraft[id];
    setTestingKey(id);
    try {
      const data = await api<{ ok: boolean; message: string; latencyMs?: number }>(
        "/api/admin/api-config/test",
        {
          method: "POST",
          body: JSON.stringify({
            provider: id,
            ...(draft?.key.trim() ? { apiKey: draft.key.trim() } : {}),
            ...(id === "narorouter" && draft?.baseUrl.trim() ? { baseUrl: draft.baseUrl.trim() } : {}),
          }),
        }
      );
      setKeyTest((prev) => ({ ...prev, [id]: { ok: data.ok, message: data.message } }));
      flash(data.ok ? "ok" : "err", `${id}: ${data.message}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test failed.";
      setKeyTest((prev) => ({ ...prev, [id]: { ok: false, message: msg } }));
      flash("err", msg);
    } finally {
      setTestingKey(null);
    }
  };

  const revertProviderToEnv = async (id: string) => {
    if (!confirm(`Revert ${id} to .env.local values (clears stored key + model overrides)?`)) return;
    try {
      const data = await api<{
        providers: Record<string, ProviderApiState>;
      }>("/api/admin/api-config", {
        method: "PUT",
        body: JSON.stringify({
          providers: { [id]: { apiKey: "", models: [], ...(id === "narorouter" ? { baseUrl: "" } : {}) } },
        }),
      });
      setApiConfig(data.providers);
      await loadApiConfig();
      flash("ok", `${id} reverted to environment configuration.`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Revert failed.");
    }
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
  };

  const filteredUsers = userSearch.trim()
    ? users.filter(
        (u) =>
          u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.uid.toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  if (gateError && !adminEmail) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent-light" />
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { id: "api", label: "API Keys", icon: <KeyRound className="w-4 h-4" /> },
    { id: "conversations", label: "Conversations", icon: <MessagesSquare className="w-4 h-4" /> },
    { id: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
    { id: "storage", label: "Storage", icon: <HardDrive className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground ambient-bg flex flex-col md:flex-row">
      {/* Left navigation */}
      <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-border bg-surface/60 backdrop-blur-md md:sticky md:top-0 md:h-dvh flex md:flex-col">
        <div className="hidden md:flex items-center gap-2.5 px-5 h-16 border-b border-border">
          <HasaLogo size={30} />
          <div className="min-w-0">
            <div className="font-bold tracking-tight flex items-center gap-1.5 text-sm">
              Mission Control <ShieldCheck className="w-3.5 h-3.5 text-accent-light" />
            </div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">{adminEmail}</div>
          </div>
        </div>
        <nav className="flex md:flex-col gap-1 p-2.5 md:p-3 overflow-x-auto flex-1" aria-label="Admin sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors md:w-full md:justify-start",
                tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              )}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="admin-tab"
                  className="absolute inset-0 rounded-xl bg-accent/15 border border-accent/30"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-2.5">{t.icon}{t.label}</span>
              {t.id === "api" && (
                <span className="relative ml-auto hidden md:inline text-[9px] font-mono px-1.5 py-px rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  keys
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2 p-3 border-t border-border">
          <button
            onClick={() => void loadUsers(null)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
            title="Refresh users"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0 text-[10px] text-muted-foreground truncate">{adminEmail}</div>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
        <div className="flex md:hidden items-center gap-1 px-2">
          <button
            onClick={() => void logout()}
            className="p-2 rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        <AnimatePresence>
          {backendDown && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Firebase Admin is not reachable (service-account keys missing in <code className="font-mono">.env.local</code>).
                User management, transcripts, storage stats and email need it. Auth-gated reads fail safe with 5xx — no data leaks.
              </span>
            </motion.div>
          )}
          {notice && (
            <motion.div
              key={notice.text}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "mb-4 rounded-2xl border px-4 py-3 text-sm",
                notice.kind === "ok"
                  ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                  : "border-rose-500/30 bg-rose-950/20 text-rose-200"
              )}
            >
              {notice.text}
            </motion.div>
          )}
        </AnimatePresence>

        {tab === "users" && (
          <FadeUp>
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
                <h2 className="text-sm font-semibold flex-1">Registered users ({users.length})</h2>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 sm:w-64">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Filter by email or UID…"
                    className="w-full bg-transparent py-2 text-sm focus:outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              {loadingUsers ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12" />)}
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No users found.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="px-4 py-2.5 font-medium">User</th>
                          <th className="px-4 py-2.5 font-medium">Created</th>
                          <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                          <th className="px-4 py-2.5 font-medium text-right">Convs</th>
                          <th className="px-4 py-2.5 font-medium text-right">Saved</th>
                          <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <Stagger component="tbody" className="">
                        {filteredUsers.map((u) => (
                          <StaggerItem component="tr" key={u.uid} className="border-b border-border/50 hover:bg-surface-hover/60 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="font-medium truncate max-w-[220px]">{u.email ?? "(no email)"}</div>
                              <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[220px]">{u.uid}</div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(u.createdAt)}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(u.lastSignIn)}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{u.conversations}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{u.savedItems}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => { setConvUid(u.uid); setTab("conversations"); void loadConvs(u.uid); }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-accent-light hover:bg-accent/10 transition-colors"
                                  title="Read conversations"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => void deleteUser(u.uid, u.email)}
                                  disabled={busyUid === u.uid}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                                  title="Delete user + all data"
                                >
                                  {busyUid === u.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </StaggerItem>
                        ))}
                      </Stagger>
                    </table>
                  </div>
                  {nextToken && (
                    <div className="p-3 border-t border-border">
                      <button
                        onClick={() => void loadUsers(nextToken)}
                        className="w-full py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
                      >
                        Load more
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </FadeUp>
        )}

        {tab === "conversations" && (
          <FadeUp>
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <h2 className="text-sm font-semibold">Inspect user conversations</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={convUid}
                  onChange={(e) => setConvUid(e.target.value)}
                  placeholder="Paste user UID…"
                  spellCheck={false}
                  className="flex-1 rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500/60"
                />
                <button
                  onClick={() => void loadConvs(convUid)}
                  disabled={loadingConvs || !convUid.trim()}
                  className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {loadingConvs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Load
                </button>
              </div>
              {convs.length === 0 && !loadingConvs ? (
                <p className="text-sm text-muted-foreground">No conversations loaded. Enter a UID above.</p>
              ) : (
                <Stagger className="space-y-2">
                  {convs.map((c) => (
                    <StaggerItem key={c.id} className="rounded-xl border border-border bg-surface-muted p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.title}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {c.messageCount} msgs · {c.selectedMode} · {formatDate(c.updatedAt)}
                          </div>
                        </div>
                        <button
                          onClick={() => void openTranscript(convUid.trim(), c.id, c.title)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-accent-light hover:bg-accent/10 transition-colors"
                          title="Read transcript"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void deleteConv(convUid.trim(), c.id, c.title)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </div>
          </FadeUp>
        )}

        {tab === "email" && (
          <FadeUp>
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 space-y-4 max-w-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Email users</h2>
                <span className={cn(
                  "text-[11px] font-mono px-2 py-1 rounded-lg border",
                  emailConfigured ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : "text-amber-300 border-amber-500/30 bg-amber-500/10"
                )}>
                  {emailConfigured === null ? "checking…" : emailConfigured ? "SMTP ready" : "SMTP not configured"}
                </span>
              </div>
              {!emailConfigured && emailConfigured !== null && (
                <details className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-amber-200 hover:text-amber-100">
                    Email is not configured — set it up free in 3 minutes (Gmail)
                  </summary>
                  <ol className="px-4 pb-3 pt-1 space-y-1.5 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
                    <li>Turn on <span className="text-foreground">2-Step Verification</span> on your Google account.</li>
                    <li>Go to Google Account → Security → <span className="text-foreground">App passwords</span> → create one for “Mail”. Copy the 16-letter code.</li>
                    <li>
                      Add to <code className="font-mono text-foreground">.env.local</code>:
                      <pre className="mt-1.5 rounded-lg bg-black/30 border border-border p-2.5 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre">{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM="HaSa AI <you@gmail.com>"`}</pre>
                    </li>
                    <li>Restart the dev server (<code className="font-mono">Ctrl+C</code>, then <code className="font-mono">npm run dev</code>). The badge above turns green.</li>
                  </ol>
                </details>
              )}
              <form onSubmit={(e) => void sendEmail(e)} className="space-y-3">
                <div className="flex gap-2">
                  {(["single", "broadcast"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBroadcast(m === "broadcast")}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors",
                        (m === "broadcast") === broadcast
                          ? "bg-accent/15 border-accent/40 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m === "broadcast" ? "Broadcast (all users)" : "Single user"}
                    </button>
                  ))}
                </div>
                {!broadcast && (
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="recipient@example.com"
                    type="email"
                    className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60"
                  />
                )}
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message… (plain text)"
                  rows={6}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 resize-y"
                />
                <button
                  type="submit"
                  disabled={sending || !emailConfigured}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-violet-950/40 hover:from-violet-400 hover:to-indigo-500 disabled:opacity-50 transition-all"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Sending…" : broadcast ? "Broadcast email" : "Send email"}
                </button>
                {!emailConfigured && emailConfigured !== null && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1${!broadcast && to.trim() ? `&to=${encodeURIComponent(to.trim())}` : ""}${subject.trim() ? `&su=${encodeURIComponent(subject.trim())}` : ""}${body.trim() ? `&body=${encodeURIComponent(body.trim())}` : ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 flex-1 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:border-violet-500/40 hover:bg-surface-hover transition-all"
                    >
                      <Mail className="w-4 h-4" />
                      {broadcast ? "Compose broadcast in Gmail" : "Continue in Gmail"}
                    </a>
                    <a
                      href={`mailto:${!broadcast && to.trim() ? encodeURIComponent(to.trim()) : ""}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(body.trim())}`}
                      className="text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors self-center px-2"
                    >
                      or use your default mail app
                    </a>
                  </div>
                )}
                {emailResult && (
                  <p className="text-xs text-muted-foreground rounded-xl border border-border bg-surface-muted p-3">{emailResult}</p>
                )}
              </form>
            </div>
          </FadeUp>
        )}

        {tab === "storage" && (
          <FadeUp>
            {!storage && !loadingStorage ? (
              <button
                onClick={() => void loadStorage()}
                className="rounded-2xl border border-dashed border-border p-8 w-full text-sm text-muted-foreground hover:text-foreground hover:border-violet-500/40 transition-colors"
              >
                Load storage overview
              </button>
            ) : loadingStorage && !storage ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24" />)}
              </div>
            ) : storage ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Users", value: storage.totals.users },
                    { label: "Conversations", value: storage.totals.conversations },
                    { label: "Messages", value: storage.totals.messages },
                    { label: "Saved items", value: storage.totals.savedItems },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                      <div className="text-2xl font-bold tracking-tight">
                        <AnimatedCounter value={s.value} />
                      </div>
                    </div>
                  ))}
                </div>

                {storage.quota && (
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-sm font-semibold">Database storage</h2>
                      <span className="text-[11px] font-mono text-muted-foreground">{storage.quota.plan}</span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-xl font-bold tracking-tight">{formatBytes(storage.quota.usedBytes)}</span>
                      <span className="text-xs text-muted-foreground">used of {formatBytes(storage.quota.bytes)} · {formatBytes(storage.quota.availableBytes)} available</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-surface-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((storage.quota.usedBytes / Math.max(storage.quota.bytes, 1)) * 100, 100)}%` }}
                        transition={{ duration: 0.9, ease: [0.21, 1.02, 0.73, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400"
                      />
                    </div>
                    {(storage.collections ?? []).length > 0 && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {storage.collections!.map((c) => (
                          <div key={c.name} className="rounded-xl border border-border bg-surface-muted px-3 py-2">
                            <div className="text-[11px] font-mono text-muted-foreground truncate">{c.name}</div>
                            <div className="text-sm font-semibold">{c.docs.toLocaleString()} <span className="font-normal text-muted-foreground">docs</span></div>
                            <div className="text-[11px] font-mono text-muted-foreground">{formatBytes(c.estimatedBytes)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm("Purge ALL usage analytics records across users? Conversations and messages are NOT touched.")) return;
                        try {
                          const r = await api<{ deleted: number }>("/api/admin/storage/purge", {
                            method: "POST",
                            body: JSON.stringify({ collection: "usage" }),
                          });
                          flash("ok", `Purged ${r.deleted} usage records.`);
                          setStorage(null);
                          void loadStorage();
                        } catch (err) {
                          flash("err", err instanceof Error ? err.message : "Purge failed.");
                        }
                      }}
                      className="mt-3 text-[11px] font-medium text-muted-foreground hover:text-rose-400 transition-colors"
                    >
                      Purge usage analytics (regenerable)
                    </button>
                  </div>
                )}
                <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h2 className="text-sm font-semibold">Footprint by user (estimates)</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{storage.note}</p>
                  </div>
                  <div className="divide-y divide-border/50">
                    {storage.users.map((u) => {
                      const max = Math.max(...storage.users.map((x) => x.estimatedBytes), 1);
                      return (
                        <div key={u.uid} className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{u.email ?? u.uid}</div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max((u.estimatedBytes / max) * 100, 2)}%` }}
                                transition={{ duration: 0.8, ease: [0.21, 1.02, 0.73, 1] }}
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                              />
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground mt-1">
                              {formatBytes(u.estimatedBytes)} · {u.conversations} convs · {u.messages} msgs · {u.savedItems} saved
                            </div>
                          </div>
                          <button
                            onClick={() => void deleteUser(u.uid, u.email)}
                            disabled={busyUid === u.uid}
                            className="p-2 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 shrink-0"
                            title="Delete user + all data"
                          >
                            {busyUid === u.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </FadeUp>
        )}

        {tab === "api" && (
          <FadeUp>
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 space-y-4 w-full max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Provider API keys + models</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Bidirectional sync: <code className="font-mono">.env.local</code> loads here automatically;
                    saving here writes back to Firestore + <code className="font-mono">.env.local</code> + live env.
                    Keys are never shown back, never sent to browsers.
                  </p>
                </div>
                <span className={cn(
                  "text-[11px] font-mono px-2 py-1 rounded-lg border shrink-0",
                  apiFirestore
                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                    : "text-amber-300 border-amber-500/30 bg-amber-500/10"
                )}>
                  {apiFirestore ? "Firestore live" : "Firestore offline"}
                </span>
              </div>

              {loadingApi ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28" />)}
                </div>
              ) : apiConfig ? (
                <Stagger className="space-y-3">
                  {(["groq", "gemini", "openrouter", "narorouter"] as const).map((id) => {
                    const current = apiConfig[id];
                    const draft = apiDraft[id] ?? { key: "", models: "", baseUrl: "" };
                    const test = keyTest[id];
                    if (!current) return null;
                    return (
                      <StaggerItem key={id} className="rounded-2xl border border-border bg-surface-muted p-3 sm:p-4 space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <KeyRound className="w-4 h-4 text-accent-light shrink-0" />
                          <span className="text-sm font-semibold capitalize flex-1 min-w-[90px]">{id === "narorouter" ? "NaroRouter" : id === "openrouter" ? "OpenRouter" : id === "groq" ? "Groq" : "Gemini"}</span>
                          {current.fromAdmin && (
                            <button
                              onClick={() => void revertProviderToEnv(id)}
                              className="text-[10px] font-medium text-muted-foreground hover:text-amber-300 transition-colors shrink-0"
                              title="Clear stored override, fall back to .env.local"
                            >
                              revert to .env
                            </button>
                          )}
                          <span className={cn(
                            "text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0",
                            current.hasKey
                              ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                              : "text-rose-300 border-rose-500/30 bg-rose-500/10"
                          )}>
                            {current.hasKey ? (current.source === "admin" ? "key: admin" : "key: .env") : "no key"}
                          </span>
                        </div>
                        {current.hasKey && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
                            <span>active: {current.maskedHint || "••••"}</span>
                            <span className="opacity-60">·</span>
                            <span>{current.envHasKey ? ".env has key" : ".env empty"}</span>
                            <span className="opacity-60">·</span>
                            <span className="break-all">{current.models.length} model{current.models.length === 1 ? "" : "s"}</span>
                          </div>
                        )}
                        <label className="block min-w-0">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            API key {current.hasKey ? "(leave blank to keep current)" : "(required to enable)"}
                          </span>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={draft.key}
                            onChange={(e) => setApiDraft((p) => ({ ...p, [id]: { ...p[id], key: e.target.value } }))}
                            placeholder={current.hasKey ? "•••••••• (unchanged)" : "Paste key here"}
                            spellCheck={false}
                            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500/60 placeholder:text-muted-foreground"
                          />
                        </label>
                        <label className="block min-w-0">
                          <span className="text-[11px] font-medium text-muted-foreground">Models (comma-separated, tried in order)</span>
                          <input
                            value={draft.models}
                            onChange={(e) => setApiDraft((p) => ({ ...p, [id]: { ...p[id], models: e.target.value } }))}
                            placeholder="model-a, model-b:free"
                            spellCheck={false}
                            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-mono focus:outline-none focus:border-violet-500/60 placeholder:text-muted-foreground"
                          />
                        </label>
                        {id === "narorouter" && (
                          <label className="block min-w-0">
                            <span className="text-[11px] font-medium text-muted-foreground">Base URL</span>
                            <input
                              value={draft.baseUrl}
                              onChange={(e) => setApiDraft((p) => ({ ...p, [id]: { ...p[id], baseUrl: e.target.value } }))}
                              placeholder="https://router.bynara.id/v1"
                              spellCheck={false}
                              className="mt-1 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-mono focus:outline-none focus:border-violet-500/60 placeholder:text-muted-foreground"
                            />
                          </label>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => void testProviderKey(id)}
                            disabled={testingKey === id || (!draft.key.trim() && !current.hasKey)}
                            className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-violet-500/40 disabled:opacity-50 transition-colors"
                          >
                            {testingKey === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                            {testingKey === id ? "Checking…" : draft.key.trim() ? "Check new key" : "Check saved key"}
                          </button>
                        </div>
                        {test && (
                          <p className={cn(
                            "text-[11px] rounded-xl border px-3 py-2 leading-relaxed",
                            test.ok
                              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                              : "border-rose-500/30 bg-rose-500/5 text-rose-200"
                          )}>
                            {test.ok ? "✓ " : "✗ "}{test.message}
                          </p>
                        )}
                      </StaggerItem>
                    );
                  })}
                </Stagger>
              ) : (
                <button
                  onClick={() => void loadApiConfig()}
                  className="rounded-2xl border border-dashed border-border p-6 w-full text-sm text-muted-foreground hover:text-foreground hover:border-violet-500/40 transition-colors"
                >
                  Load API configuration
                </button>
              )}

              {apiConfig && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => void saveApiConfig()}
                    disabled={savingApi || !apiFirestore}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-violet-950/40 hover:from-violet-400 hover:to-indigo-500 disabled:opacity-50 transition-all"
                  >
                    {savingApi ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {savingApi ? "Saving…" : "Save keys + models"}
                  </button>
                  <button
                    onClick={() => void loadApiConfig()}
                    disabled={loadingApi}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-violet-500/40 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Re-read .env.local
                  </button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Leaving a key blank keeps the stored key — only typed values replace it and sync to{" "}
                <code className="font-mono">.env.local</code>. Switching provider/model mid-answer stops the
                old stream and re-answers once with full context.
              </p>
            </div>
          </FadeUp>
        )}
      </main>

        {/* Transcript drawer */}
      <AnimatePresence>
        {openConv && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenConv(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-surface border-l border-border flex flex-col"
            >
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{openConv.title}</div>
                  <div className="text-[11px] text-muted-foreground">{openConv.messages.length} messages (read-only)</div>
                </div>
                <button
                  onClick={() => setOpenConv(null)}
                  className="p-2 rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  aria-label="Close transcript"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingTranscript ? (
                  <div className="space-y-2"><div className="skeleton h-16" /><div className="skeleton h-24" /></div>
                ) : (
                  openConv.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-xl p-3 text-sm",
                        m.role === "user"
                          ? "ml-8 bg-[#1d2232] border border-slate-700/40"
                          : "mr-8 bg-surface-muted border border-border"
                      )}
                    >
                      <div className="text-[10px] font-mono text-muted-foreground mb-1">
                        {m.role}{m.provider ? ` · ${m.provider}${m.model ? ` / ${m.model}` : ""}` : ""} · {formatDate(m.createdAt)}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed max-h-64 overflow-y-auto">
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
