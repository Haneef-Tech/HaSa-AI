"use client";

import { apiFetch } from "./client";

export interface ApiModel {
  id: string;
  provider: string;
  displayName: string;
  description: string;
  capabilities: string[];
  contextWindow?: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsJson: boolean;
  speed: "fast" | "medium" | "slow";
  quality: "standard" | "high" | "premium";
  enabled: boolean;
}

export interface ProviderStatus {
  provider: string;
  available: boolean;
  latencyMs?: number;
  checkedAt: string;
  reason?: string;
}

export async function fetchModels(): Promise<ApiModel[]> {
  const data = await apiFetch<{ models: ApiModel[] }>("/api/models");
  return data.models;
}

export async function fetchProviderHealth(): Promise<ProviderStatus[]> {
  const data = await apiFetch<{ providers: ProviderStatus[] }>("/api/providers/health");
  return data.providers;
}
