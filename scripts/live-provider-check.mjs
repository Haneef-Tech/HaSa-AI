/**
 * Live provider connectivity check (OPT-IN — touches real APIs).
 * Run: npm run check:providers
 *
 * Reads .env.local (gitignored), calls each configured provider's cheapest
 * health signal, and prints ONLY shapes (ok/fail, model ids, token counts).
 * Never prints API keys or message content.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}. Copy .env.example to .env.local first.`);
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function checkOpenAICompatible(name, { baseURL, apiKey, model }) {
  if (!apiKey) {
    console.log(`${name}: SKIP (key missing)`);
    return;
  }
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey, baseURL, timeout: 30000, maxRetries: 0 });
    const list = await client.models.list();
    const ids = list.data.map((m) => m.id);
    const entitled = model ? ids.includes(model) : "n/a";
    console.log(`${name}: OK (${ids.length} models entitled, default=${model || "unset"} entitled=${entitled})`);
    if (process.argv.includes("--ids")) {
      const interesting = ids.filter((id) => /claude|sonnet|deepseek|gpt|gemini|llama|qwen|mistral|opus/i.test(id));
      console.log(`  candidate ids:\n  - ${(interesting.length ? interesting : ids).join("\n  - ")}`);
    }
    if (process.argv.includes("--free")) {
      const free = ids.filter((id) => id.endsWith(":free"));
      console.log(`  FREE ids (${free.length}):\n  - ${free.join("\n  - ")}`);
    }
  } catch (err) {
    console.log(`${name}: FAIL (${err?.status ?? ""} ${err?.message ?? err})`.trim());
    process.exitCode = 1;
  }
}

async function checkGroq() {
  const apiKey = process.env.GROQ_API_KEY ?? "";
  if (!apiKey) {
    console.log("groq: SKIP (key missing)");
    return;
  }
  try {
    const { default: Groq } = await import("groq-sdk");
    const client = new Groq({ apiKey, timeout: 30000, maxRetries: 0 });
    const list = await client.models.list();
    const model = process.env.GROQ_MODEL ?? "";
    const ids = list.data.map((m) => m.id);
    console.log(`groq: OK (${ids.length} models listed, default=${model} entitled=${ids.includes(model)})`);
    if (process.argv.includes("--ids")) console.log(`  ids:\n  - ${ids.join("\n  - ")}`);
  } catch (err) {
    console.log(`groq: FAIL (${err?.status ?? ""} ${err?.message ?? err})`.trim());
    process.exitCode = 1;
  }
}

async function checkGemini() {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    console.log("gemini: SKIP (key missing)");
    return;
  }
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Reply with exactly: ok" }] }],
      // Generous cap: thinking models consume output budget on internal
      // reasoning first — a low cap yields empty visible text.
      generationConfig: { temperature: 0, maxOutputTokens: 512 },
    });
    const usage = result.response.usageMetadata;
    console.log(
      `gemini: OK (reply chars=${result.response.text().length}, ` +
        `prompt=${usage?.promptTokenCount}, completion=${usage?.candidatesTokenCount})`
    );
  } catch (err) {
    console.log(`gemini: FAIL (${err?.message ?? err})`);
    process.exitCode = 1;
  }
}

loadEnv();
await checkGroq();
await checkGemini();
await checkOpenAICompatible("openrouter", {
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  model: (process.env.OPENROUTER_MODELS ?? "").split(",")[0]?.trim() ?? "",
});
await checkOpenAICompatible("nara", {
  baseURL: "https://router.bynara.id/v1",
  apiKey: process.env.NARA_ROUTER_API_KEY ?? "",
  model: process.env.NARA_MODEL ?? "",
});
console.log(process.exitCode ? "LIVE CHECK: failures above" : "LIVE CHECK: all configured providers reachable");
