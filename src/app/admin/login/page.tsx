"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { HasaLogo } from "@/components/branding/HasaLogo";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your admin email and password.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Sign in failed.");
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-8 bg-background ambient-bg">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.21, 1.02, 0.73, 1] }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative p-3 rounded-2xl bg-surface-elevated border border-border shadow-lg shadow-violet-950/30"
          >
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-violet-600/30 to-cyan-400/20 blur-xl -z-10" aria-hidden />
            <HasaLogo size={40} />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent-light" /> Mission Control
          </h1>
          <p className="text-sm text-muted-foreground">Restricted area — HaSa AI administrators only.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-surface/90 backdrop-blur-sm p-6 shadow-xl space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2.5 text-sm text-rose-200">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Admin email</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-violet-500/60 transition-colors">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-transparent py-2.5 text-sm focus:outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-violet-500/60 transition-colors">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent py-2.5 text-sm focus:outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-950/40 hover:from-violet-400 hover:to-indigo-500 transition-all disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {busy ? "Verifying…" : "Enter Mission Control"}
          </motion.button>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to HaSa AI
          </Link>
        </form>
      </motion.div>
    </div>
  );
}
