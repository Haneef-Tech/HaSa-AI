"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { HasaLogo } from "@/components/branding/HasaLogo";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const { signIn, signUp, error, clearError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError("Please enter your email and password.");
      return;
    }
    if (isSignup && password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (isSignup) await signUp(email, password);
      else await signIn(email, password);
      router.replace("/");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const shownError = localError ?? error;

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center px-4 py-8 bg-background ambient-bg">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="p-3 rounded-2xl bg-surface-elevated border border-border shadow-lg shadow-violet-950/20">
            <HasaLogo size={40} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isSignup ? "Create your HaSa AI account" : "Welcome back to HaSa AI"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isSignup
              ? "Private, provider-agnostic AI workspace. Your chats are secured with Firebase Auth."
              : "Sign in to access your private conversations and saved highlights."}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-surface/90 backdrop-blur-sm p-6 shadow-xl shadow-violet-950/10 space-y-4 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
        >
          {shownError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2.5 text-xs text-rose-200 leading-relaxed">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{shownError}</span>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-violet-500/60">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-violet-500/60">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </label>

          {isSignup && (
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Confirm password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-violet-500/60">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </label>
          )}

          <motion.button
            type="submit"
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSignup ? (
              <UserPlus className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </motion.button>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            {isSignup ? (
              <span>
                Have an account?{" "}
                <Link href="/login" className="text-accent-light hover:underline">
                  Sign in
                </Link>
              </span>
            ) : (
              <>
                <Link href="/forgot-password" className="hover:text-foreground hover:underline">
                  Forgot password?
                </Link>
                <span>
                  New here?{" "}
                  <Link href="/signup" className="text-accent-light hover:underline">
                    Create account
                  </Link>
                </span>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
