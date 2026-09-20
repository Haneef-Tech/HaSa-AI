import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * .env.local <-> Admin bidirectional sync.
 * - READ: admin GET parses the dotenv file from disk so manual `.env.local`
 *   edits show up in Mission Control without a server restart. process.env
 *   alone is frozen at boot, so disk is the source of truth for "env" values.
 * - WRITE: admin PUT upserts changed keys/models back into `.env.local`
 *   (database/Firestore remains primary; the file keeps restarts consistent)
 *   and mirrors them into live `process.env` so chat uses them immediately.
 */

const DOTENV_CANDIDATES = [".env.local", ".env"];

export function resolveEnvFilePath(): string {
  return path.join(process.cwd(), DOTENV_CANDIDATES[0]);
}

function parseDotEnv(src: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const rawLine of src.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) map.set(key, val);
  }
  return map;
}

/** Best-effort read of the dotenv file (empty map when missing/unreadable). */
export async function readEnvFileValues(): Promise<{ path: string; values: Map<string, string> }> {
  const filePath = resolveEnvFilePath();
  try {
    const src = await fs.readFile(filePath, "utf8");
    return { path: filePath, values: parseDotEnv(src) };
  } catch {
    return { path: filePath, values: new Map() };
  }
}

/** Upsert KEY=VALUE lines, preserving comments/order. Creates the file if missing. */
export async function upsertEnvFileValues(updates: Record<string, string>): Promise<string> {
  const filePath = resolveEnvFilePath();
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return filePath;
  let src = "";
  try {
    src = await fs.readFile(filePath, "utf8");
  } catch {
    src = "";
  }
  const lines = src.length > 0 ? src.split(/\r?\n/) : [];
  const seen = new Set<string>();
  const out = lines.map((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) return rawLine;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return rawLine;
    const key = trimmed.slice(0, eq).trim();
    const hit = entries.find(([k]) => k === key);
    if (hit) {
      seen.add(key);
      return `${key}=${hit[1]}`;
    }
    return rawLine;
  });
  for (const [k, v] of entries) {
    if (!seen.has(k)) {
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      out.push(`${k}=${v}`);
    }
  }
  await fs.writeFile(filePath, out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n", "utf8");
  // Mirror into the live process so the running server uses them immediately.
  for (const [k, v] of entries) {
    process.env[k] = v;
  }
  return filePath;
}

/** Never expose key material — show `abcd…wxyz` hints only. */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** Provider -> dotenv variable mapping (canonical + legacy aliases kept in sync). */
export const ENV_VAR_MAP = {
  groq: { keyVars: ["GROQ_API_KEY"], modelsVar: "GROQ_MODEL" },
  gemini: { keyVars: ["GEMINI_API_KEY"], modelsVar: "GEMINI_MODELS" },
  openrouter: { keyVars: ["OPENROUTER_API_KEY"], modelsVar: "OPENROUTER_MODELS" },
  narorouter: {
    keyVars: ["NAROROUTER_API_KEY", "NARA_ROUTER_API_KEY"],
    modelsVar: "NARA_MODELS",
    baseUrlVar: "NAROROUTER_BASE_URL",
  },
} as const;
