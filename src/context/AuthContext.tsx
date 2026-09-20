"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthState,
} from "@/lib/firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyAuthError(code: string, rawMessage?: string): string {
  if (
    code.includes("configuration-not-found") ||
    code.includes("CONFIGURATION_NOT_FOUND") ||
    (rawMessage && rawMessage.includes("CONFIGURATION_NOT_FOUND"))
  ) {
    return "Firebase Authentication is not activated in project 'hasa-25ec7' yet. Please enable Email/Password in Firebase Console > Authentication > Sign-in method.";
  }
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and retry.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is not enabled in Firebase Console. Please enable it under Authentication > Sign-in method.";
    default:
      return "Authentication failed. Please check your credentials.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = subscribeToAuthState((u) => {
        if (!mounted) return;
        setUser(u);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch {
      if (mounted) {
        setLoading(false);
      }
      return () => {
        mounted = false;
      };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const u = await signUpWithEmail(email.trim(), password);
      setUser(u);
    } catch (e) {
      const errObj = e as { code?: string; message?: string };
      const code = errObj.code ?? "";
      const msg = friendlyAuthError(code, errObj.message);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const u = await signInWithEmail(email.trim(), password);
      setUser(u);
    } catch (e) {
      const errObj = e as { code?: string; message?: string };
      const code = errObj.code ?? "";
      const msg = friendlyAuthError(code, errObj.message);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutUser();
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ user, loading, error, signUp, signIn, signOut, clearError }),
    [user, loading, error, signUp, signIn, signOut, clearError]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider.");
  return ctx;
}
