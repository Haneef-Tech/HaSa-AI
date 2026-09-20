"use client";

import { getIdToken } from "@/lib/firebase/auth";

export interface ApiError {
  code: string;
  message: string;
  retryAfterMs?: number;
  details?: unknown;
  status: number;
}

export async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  let code = "INTERNAL_ERROR";
  let message = `Request failed with status ${res.status}.`;
  let retryAfterMs: number | undefined;
  let details: unknown;
  try {
    const data = await res.json();
    if (data?.error) {
      code = data.error.code ?? code;
      message = data.error.message ?? message;
      retryAfterMs = data.error.retryAfterMs;
      details = data.error.details;
    }
  } catch {
    // non-JSON error body
  }
  const retryHeader = res.headers.get("Retry-After");
  if (retryAfterMs === undefined && retryHeader) {
    const secs = parseInt(retryHeader, 10);
    if (!Number.isNaN(secs)) retryAfterMs = secs * 1000;
  }
  return { code, message, retryAfterMs, details, status: res.status };
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken().catch(() => null);
  if (!token) throw { code: "UNAUTHORIZED", message: "You are not signed in.", status: 401 } as ApiError;
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw await apiErrorFromResponse(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
