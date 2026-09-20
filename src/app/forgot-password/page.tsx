"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { sendResetEmail } from "@/lib/firebase/auth";
import { HasaLogo } from "@/components/branding/HasaLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!email.trim()) {
      setStatus({ ok: false, msg: "Please enter your email address." });
      return;
    }
    setBusy(true);
    try {
      await sendResetEmail(email.trim());
      setStatus({ ok: true, msg: "Password reset email sent. Check your inbox." });
    } catch {
      setStatus({ ok: false, msg: "Could not send reset email. Verify the address and retry." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center px-4 py-8 bg-background ambient-bg">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="p-3 rounded-2xl bg-surface-elevated border border-border shadow-lg">
            <HasaLogo size={40} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">We&apos;ll email you a secure reset link.</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-6 space-y-4 shadow-xl">
          {status && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                status.ok
                  ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                  : "border-rose-500/30 bg-rose-950/20 text-rose-200"
              }`}
            >
              {status.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
              <span>{status.msg}</span>
            </div>
          )}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-violet-500/60">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/login" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
}
