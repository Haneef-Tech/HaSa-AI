import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from "./provider.interface";
import { IDENTITY_HYPE_RESPONSE, matchesIdentityQuery } from "@/lib/context/identity";

/**
 * Mock provider (Phase 2). Deterministic keyword-based responses so the
 * frontend streaming + persistence flow can be tested without real LLM keys.
 * Real providers (Groq/Gemini/OpenRouter) will implement LLMProvider in Phase 3.
 */

const MOCK_PROVIDER = "HaSa Mock";
const MOCK_MODEL = "Preview Model";

function pickTemplate(message: string): string {
  // Developer identity ALWAYS wins — and only fires when explicitly asked.
  if (matchesIdentityQuery(message)) return IDENTITY_HYPE_RESPONSE;

  const lower = message.toLowerCase();
  const excerpt = message.slice(0, 90);

  if (/(python|code|fastapi|pipeline|script|algorithm|typescript|function|bug|refactor)/.test(lower)) {
    return `## Python Solution & Technical Breakdown\n\nBased on your requirement: *"${excerpt}..."\*\n\nHere is a clean, production-ready implementation designed for reliability:\n\n\`\`\`python\nimport asyncio\nfrom dataclasses import dataclass\nfrom typing import Any, Dict\n\n@dataclass\nclass ProcessingResult:\n    status: str\n    processed_items: int\n    execution_time_ms: float\n    metadata: Dict[str, Any]\n\nasync def execute_task_pipeline(data_source: str, batch_size: int = 100) -> ProcessingResult:\n    \"\"\"Async processing with bounded concurrency and error handling.\"\"\"\n    await asyncio.sleep(0.05)\n    return ProcessingResult(\n        status="completed",\n        processed_items=batch_size,\n        execution_time_ms=48.2,\n        metadata={"engine": "HaSa Mock Runner", "version": "3.12"},\n    )\n\`\`\`\n\n:::important[variant=info,title=Architecture Tip]\nKeep worker processes stateless so you can horizontally scale across replicas.\n:::\n\n### Key Features\n- **Async Concurrency**: Non-blocking event loop execution.\n- **Type Safety**: Strictly typed with dataclasses.\n- **Error Boundaries**: Structured capture without crashing the parent process.`;
  }

  if (/(learn|study|course|roadmap|explain|concept|how|what is|analogy)/.test(lower)) {
    return `## Intuitive Explanation\n\nLet's break this down with a structured mental model.\n\n### 1. The Core Analogy\nThink of this like an **air traffic control system**: instead of every plane negotiating individually, a coordinator maintains an agreed sequence.\n\n### 2. Step-by-Step\n1. **State Discovery**: Nodes broadcast current state.\n2. **Quorum Verification**: A majority validates each transition.\n3. **Fault Tolerance**: Up to \`f\` failures tolerated in \`2f + 1\` nodes.\n\n:::important[variant=info,title=Key Takeaway]\nConsensus achieves agreement across unreliable networks without a single trusted coordinator.\n:::\n\nWant edge cases or implementation details next?`;
  }

  if (/(business|market|pricing|strategy|startup|revenue|idea)/.test(lower)) {
    return `## Strategic Business & Feasibility Analysis\n\n### 1. Market Opportunity\n- **Growth driver**: Enterprise AI adoption (~24% CAGR).\n- **Value wedge**: Replacing slow manual verification with real-time automation.\n\n### 2. Unit Economics\n\n| Dimension | Early Stage | Scaled |\n| :--- | :--- | :--- |\n| **CAC** | $4,500 – $8,000 | $2,200 |\n| **ACV** | $25,000 | $60,000+ |\n| **Gross Margin** | 68% | 82% |\n\n:::important[variant=warning,title=Competitive Moat Consideration]\nPure UI wrappers have low defensibility. Build moats via proprietary data or deep workflow integrations.\n:::\n\n### 3. Next Steps\n1. Run 15 discovery interviews.\n2. Build an interactive proof-of-concept.\n3. Target time-to-value under 10 minutes.`;
  }

  if (/(agri|mandi|crop|farm|data|clean|csv|sql|schema|dashboard|pandas|polars)/.test(lower)) {
    return `## Data & Schema Guidance\n\nFor large tabular workloads, prefer **columnar streaming** (Polars lazy frames, Parquet with Zstandard) over in-memory pandas copies.\n\n\`\`\`python\nimport polars as pl\n\n(pl.scan_csv("raw.csv", ignore_errors=True)\n   .with_columns([\n       pl.col("customer_id").str.strip_chars(),\n       pl.col("amount").fill_null(pl.col("amount").median()),\n   ])\n   .filter(pl.col("amount\") > 0)\n   .sink_parquet("clean.parquet", compression="zstd"))\n\`\`\`\n\n:::important[variant=success,title=Optimization Verified]\nParquet + Zstandard typically shrinks CSVs ~7x and speeds queries ~15x.\n:::\n\nTell me your row count and memory budget and I'll size chunking for you.`;
  }

  return `## Analysis & Overview\n\nThank you — here is a clear, actionable overview for *"${excerpt}..."*\n\n### Primary Considerations\n1. **Scope Definition**: Clarify objectives and success criteria.\n2. **Iterative Execution**: Build modular components for easy testing.\n3. **Observability**: Keep logging, tracing, and metrics from day one.\n\n:::important[variant=info,title=HaSa AI Note]\nThis is a **mock streaming preview** (no external LLM call). Real Groq / Gemini / OpenRouter routing lands in Phase 3.\n:::\n\n### Action Plan\n- [x] Confirm inputs and constraints\n- [x] Add an automated test suite\n- [ ] Deploy a staging prototype\n\nAsk me to elaborate on any section!`;
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.33);
}

export class MockProvider implements LLMProvider {
  readonly id = "hasa-mock";
  readonly label = MOCK_PROVIDER;
  readonly configured = true;
  /** When true, stream() throws to let tests exercise failure paths. */
  failNextStream = false;

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (request.signal?.aborted) throw new Error("Generation aborted by client.");
    const content = pickTemplate(request.currentMessage);
    const promptTokens = estimateTokens(
      request.history.map((h) => h.content).join("\n") + "\n" + request.currentMessage
    );
    const completionTokens = estimateTokens(content);
    return {
      content,
      provider: MOCK_PROVIDER,
      model: MOCK_MODEL,
      mode: request.mode,
      isMock: true,
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async *stream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    if (this.failNextStream) {
      this.failNextStream = false;
      throw new Error("Mock provider intermittent failure (simulated).");
    }
    const full = pickTemplate(request.currentMessage);
    // Word-preserving chunks for a realistic streaming effect.
    const tokens = full.match(/\S+|\s+/g) ?? [full];
    let batch = "";
    for (const tok of tokens) {
      if (request.signal?.aborted) return;
      batch += tok;
      // Emit roughly every 3 tokens to reduce event overhead.
      if (batch.length > 24 || /[.!?\n]$/.test(tok)) {
        yield { delta: batch };
        batch = "";
        await new Promise((r) => setTimeout(r, 12));
      }
    }
    if (batch) yield { delta: batch };
    // Single-pass telemetry so callers never need a second generate() call.
    const promptTokens = estimateTokens(
      request.history.map((h) => h.content).join("\n") + "\n" + request.currentMessage
    );
    const completionTokens = estimateTokens(full);
    if (request.telemetry) {
      request.telemetry.provider = MOCK_PROVIDER;
      request.telemetry.model = MOCK_MODEL;
      request.telemetry.isMock = true;
      request.telemetry.usage = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

export const mockProvider = new MockProvider();

export const MOCK_METADATA = {
  provider: MOCK_PROVIDER,
  model: MOCK_MODEL,
  isMock: true,
} as const;
