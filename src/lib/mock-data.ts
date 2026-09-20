import { Conversation, Message, ModelOption } from "@/types/chat";

export const MOCK_MODES: ModelOption[] = [
  {
    id: "auto",
    name: "Auto",
    provider: "HaSa Router",
    mode: "auto",
    description: "Intelligently routes across Groq, Gemini, OpenRouter, or Nara Router based on your task",
    badge: "Recommended",
    latencyAvg: "~0.7s",
  },
  {
    id: "fast",
    name: "Fast",
    provider: "Groq (gpt-oss-20b)",
    mode: "fast",
    description: "Optimized for lightning-fast answers, instant coding, and quick summaries",
    badge: "Low Latency",
    latencyAvg: "~0.3s",
  },
  {
    id: "balanced",
    name: "Balanced",
    provider: "Gemini 3.6 Flash",
    mode: "balanced",
    description: "Ideal balance of reasoning depth, speed, and large context windows",
    badge: "Versatile",
    latencyAvg: "~0.9s",
  },
  {
    id: "reasoning",
    name: "Reasoning",
    provider: "OpenRouter (DeepSeek free)",
    mode: "reasoning",
    description: "Deep mathematical reasoning, complex architecture, and deep logic analysis",
    badge: "Deep Thinking",
    latencyAvg: "~2.4s",
  },
];

export const SUGGESTED_PROMPTS = [
  {
    id: "concept",
    title: "Explain a difficult technical concept simply",
    description: "Break down distributed consensus or neural attention mechanisms into plain analogies",
    prompt: "Can you explain how distributed consensus (like Raft or Paxos) works using a simple real-world analogy?",
    icon: "Sparkles",
  },
  {
    id: "python",
    title: "Help me build a Python project",
    description: "Scaffold an asynchronous FastAPI microservice with automated validation & testing",
    prompt: "Help me design an async Python data processing pipeline with Pydantic v2 validation, rate-limiting, and unit tests.",
    icon: "Code2",
  },
  {
    id: "business",
    title: "Analyze this business idea",
    description: "Evaluate market feasibility, unit economics, and competitive differentiation",
    prompt: "Analyze the business model of an AI-powered automated inventory audit platform for regional retail chains. Detail risks and competitive moat.",
    icon: "TrendingUp",
  },
  {
    id: "learning",
    title: "Create a step-by-step learning plan",
    description: "Personalized 8-week curriculum for mastering modern generative AI engineering",
    prompt: "Create an 8-week structured roadmap to master LLM orchestration, evaluation metrics, and vector search from intermediate Python.",
    icon: "GraduationCap",
  },
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-rag-pipeline",
    title: "Building a RAG pipeline",
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago (Today)
    pinned: true,
    lastMessageSnippet: "Here is the production retrieval-augmented generation architecture with hybrid search...",
    messageCount: 4,
  },
  {
    id: "conv-python-cleaning",
    title: "Python data-cleaning assistant",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago (Today)
    pinned: false,
    lastMessageSnippet: "Use Polars or pandas with chunking to handle the 4GB CSV file without memory spikes...",
    messageCount: 3,
  },
  {
    id: "conv-agri-dashboard",
    title: "Agricultural price dashboard",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), // Yesterday
    pinned: false,
    lastMessageSnippet: "Here is the schema for tracking wholesale commodity arrivals and market spot prices...",
    messageCount: 2,
  },
  {
    id: "conv-ai-portfolio",
    title: "AI engineer portfolio ideas",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago (Previous 7 days)
    pinned: false,
    lastMessageSnippet: "Top 3 standout projects: Multi-agent code reviewer, local RAG benchmark, and model router...",
    messageCount: 2,
  },
];

export const MOCK_MESSAGES_MAP: Record<string, Message[]> = {
  "conv-rag-pipeline": [
    {
      id: "msg-1-user",
      role: "user",
      content: "How should I design an enterprise RAG pipeline that handles both semantic vector search and exact keyword matching?",
      createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    },
    {
      id: "msg-1-assistant",
      role: "assistant",
      content: `## Hybrid RAG Architecture

To achieve high precision and high recall, enterprise RAG systems combine **dense vector retrieval** (semantic embeddings) with **sparse lexical retrieval** (BM25 / SPLADE), followed by a **cross-encoder reranker**.

### 1. Key Pipeline Stages

1. **Ingestion & Chunking**: Recursive semantic chunking preserving table markdown and document headings.
2. **Dual Indexing**:
   - Dense vector index (e.g. Qdrant / Pinecone / pgvector) using models like \`text-embedding-3-small\`.
   - Sparse lexical index (Elasticsearch / OpenSearch or BM25 index).
3. **Reciprocal Rank Fusion (RRF)**: Merging dense and sparse ranks before reranking.
4. **Cross-Encoder Reranking**: Re-scoring top 50 candidates using Cohere Rerank or BGE-Reranker-Large to distill the top 5 most relevant context snippets.

:::important[variant=info,title=Architecture Guideline]
Never feed raw vector search results directly into the LLM context without reranking. Cross-encoders eliminate false-positive semantic matches and improve precision by up to 35%.
:::

### 2. Python Implementation Example

Here is a modular Python implementation demonstrating the hybrid retrieval fusion step:

\`\`\`python
import numpy as np
from typing import List, Dict, Any

def reciprocal_rank_fusion(
    dense_results: List[Dict[str, Any]], 
    sparse_results: List[Dict[str, Any]], 
    k: int = 60
) -> List[Dict[str, Any]]:
    """
    Combines dense semantic and sparse lexical search rankings
    using standard Reciprocal Rank Fusion (RRF).
    """
    rrf_scores: Dict[str, float] = {}
    doc_lookup: Dict[str, Dict[str, Any]] = {}

    # Score dense candidates
    for rank, doc in enumerate(dense_results):
        doc_id = doc["id"]
        doc_lookup[doc_id] = doc
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))

    # Score sparse lexical candidates
    for rank, doc in enumerate(sparse_results):
        doc_id = doc["id"]
        doc_lookup[doc_id] = doc
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))

    # Sort descending by fused score
    sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    
    return [
        {**doc_lookup[doc_id], "rrf_score": score} 
        for doc_id, score in sorted_docs
    ]
\`\`\`

### 3. Comparison Matrix

| Retrieval Method | Strength | Vulnerability | Ideal Use Case |
| :--- | :--- | :--- | :--- |
| **Dense Vector** | Conceptual & semantic nuance | Specific part numbers, exact acronyms | Question answering, thematic queries |
| **Sparse BM25** | Exact keywords, codes, SKUs | Synonyms and paraphrased terms | Legal clauses, part IDs, rare keywords |
| **Hybrid + Reranker** | Maximum recall & precision | ~40ms additional reranking latency | Enterprise mission-critical search |

:::important[variant=warning,title=Production Security Notice]
Ensure tenant isolation at the vector database namespace level. Never rely solely on application-level filtering for multi-tenant data retrieval.
:::`,
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      provider: "HaSa Auto",
      model: "Smart selection preview",
      latency: "0.8s",
      mode: "auto",
    },
  ],
  "conv-python-cleaning": [
    {
      id: "msg-2-user",
      role: "user",
      content: "I have a messy 2GB customer transaction CSV with malformed timestamps and missing values. How can I clean it efficiently in Python?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: "msg-2-assistant",
      role: "assistant",
      content: `## High-Performance Data Cleaning with Polars

For a 2GB dataset, standard \`pandas\` will create multiple memory copies and easily consume 8–10GB of RAM. **Polars** with lazy evaluation (\`lazy()\`) processes this streamingly in parallel in under 5 seconds with minimal memory overhead.

### Cleaning Pipeline Script

\`\`\`python
import polars as pl

def clean_transactions(file_path: str, output_path: str):
    """
    Cleans customer transaction records using lazy evaluation:
    - Normalizes inconsistent ISO timestamps
    - Imputes null numeric amounts with median values
    - Strips whitespace from customer IDs
    - Filters out corrupted negative amounts
    """
    clean_plan = (
        pl.scan_csv(file_path, ignore_errors=True)
        .with_columns([
            # Strip string whitespace
            pl.col("customer_id").str.strip_chars().alias("customer_id"),
            # Coerce varied datetime formats safely
            pl.col("timestamp")
              .str.to_datetime("%Y-%m-%d %H:%M:%S", strict=False)
              .alias("transaction_dt"),
            # Fill null amounts with column median
            pl.col("amount")
              .fill_null(pl.col("amount").median())
              .alias("clean_amount"),
        ])
        .filter(
            (pl.col("clean_amount") > 0) & 
            (pl.col("transaction_dt").is_not_null())
        )
    )

    # Execute streaming write to Parquet for 80% compression
    clean_plan.sink_parquet(output_path, compression="zstd")
    print(f"Dataset cleaned and written to {output_path}")

clean_transactions("raw_transactions.csv", "clean_transactions.parquet")
\`\`\`

:::important[variant=success,title=Optimization Verified]
Switching from CSV to Zstandard-compressed Parquet typically reduces file size from 2.0GB down to approximately 280MB while speeding up downstream queries by 15x.
:::`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      provider: "Groq",
      model: "Llama 3.3 70B (Fast Mode)",
      latency: "0.3s",
      mode: "fast",
    },
  ],
  "conv-agri-dashboard": [
    {
      id: "msg-3-user",
      role: "user",
      content: "What database schema should I use for an agricultural price monitoring dashboard tracking daily arrivals across 500 mandis?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    },
    {
      id: "msg-3-assistant",
      role: "assistant",
      content: `## Recommended Time-Series Schema

For tracking agricultural mandi arrivals and modal prices across hundreds of regional markets, a normalized PostgreSQL schema with **TimescaleDB hypertables** or ClickHouse is optimal.

### Relational Table Design

\`\`\`sql
-- Master Table: Mandis / Markets
CREATE TABLE mandis (
    id SERIAL PRIMARY KEY,
    mandi_code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    state VARCHAR(64) NOT NULL,
    district VARCHAR(64) NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6)
);

-- Master Table: Commodities & Varieties
CREATE TABLE commodities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(96) NOT NULL,
    category VARCHAR(48) NOT NULL, -- e.g., 'Cereals', 'Oilseeds', 'Vegetables'
    standard_unit VARCHAR(16) DEFAULT 'Quintal'
);

-- Time-Series Hypertable: Daily Market Arrivals & Pricing
CREATE TABLE daily_mandi_prices (
    recorded_date DATE NOT NULL,
    mandi_id INT REFERENCES mandis(id),
    commodity_id INT REFERENCES commodities(id),
    variety VARCHAR(64),
    min_price NUMERIC(10, 2),
    max_price NUMERIC(10, 2),
    modal_price NUMERIC(10, 2) NOT NULL,
    arrival_quantity NUMERIC(12, 2) NOT NULL, -- in Quintals
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (recorded_date, mandi_id, commodity_id, variety)
);

CREATE INDEX idx_prices_commodity_date ON daily_mandi_prices (commodity_id, recorded_date DESC);
\`\`\`

:::important[variant=info,title=Data Ingestion Tip]
Partition \`daily_mandi_prices\` by month or use TimescaleDB chunking with a 1-month chunk interval for fast sub-second trend aggregations.
:::`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
      provider: "Google Gemini",
      model: "Gemini 2.5 Flash",
      latency: "0.9s",
      mode: "balanced",
    },
  ],
  "conv-ai-portfolio": [
    {
      id: "msg-4-user",
      role: "user",
      content: "What portfolio projects will truly make an AI engineer stand out in 2026?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
    {
      id: "msg-4-assistant",
      role: "assistant",
      content: `## Standout AI Engineering Projects for 2026

Recruiters and engineering leads are exhausted by generic LangChain wrappers. Standout projects demonstrate **systems engineering**, **latency optimization**, **evaluations (Evals)**, and **real-world production constraints**.

### 1. Multi-Provider Intelligent Model Router
- **Core Concept**: An open-source reverse proxy that classifies query intent and routes to Groq for speed, Gemini for large context, or Claude/DeepSeek for complex math.
- **Key Skills**: Latency budgeting, fallback cascades, streaming SSE, telemetry, and automated cost tracking.

### 2. Rigorous Synthetic Evaluation Harness
- **Core Concept**: A benchmark framework assessing hallucination rates, tool-call fidelity, and schema adherence across model releases.
- **Key Skills**: Ground-truth dataset creation, LLM-as-a-judge calibration, statistical confidence intervals.

### 3. Edge-Accelerated Local RAG with Hybrid Quantization
- **Core Concept**: Offline desktop application using WebGPU / ONNX Runtime running small reasoning models (e.g. Gemma 2 / Qwen 2.5) with local vector indexing.
- **Key Skills**: Memory profiling, token streaming optimization, WebAssembly/C++ bindings.

:::important[variant=success,title=Portfolio Advice]
Include live interactive demos, comprehensive READMEs with architectural diagrams, and reproducible automated test suites with GitHub Actions.
:::`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      provider: "OpenRouter",
      model: "Claude 3.5 Sonnet",
      latency: "1.4s",
      mode: "reasoning",
    },
  ],
};

export const MOCK_RESPONSE_TEMPLATES = [
  {
    keywords: ["python", "code", "fastapi", "pipeline", "script", "algorithm"],
    generate: (prompt: string) => `## Python Solution & Technical Breakdown

Based on your requirement: *"${prompt.slice(0, 70)}..."*

Here is a clean, production-ready implementation designed for reliability and performance:

\`\`\`python
import asyncio
from typing import Optional, Dict, Any
from dataclasses import dataclass

@dataclass
class ProcessingResult:
    status: str
    processed_items: int
    execution_time_ms: float
    metadata: Dict[str, Any]

async def execute_task_pipeline(data_source: str, batch_size: int = 100) -> ProcessingResult:
    """
    Executes async asynchronous processing with bounded concurrency 
    and built-in error handling.
    """
    print(f"Initializing pipeline for source: {data_source} (batch size: {batch_size})")
    
    # Simulate non-blocking I/O operation
    await asyncio.sleep(0.05)
    
    return ProcessingResult(
        status="completed",
        processed_items=batch_size,
        execution_time_ms=48.2,
        metadata={"engine": "HaSa Python Runner", "version": "3.12"}
    )

if __name__ == "__main__":
    result = asyncio.run(execute_task_pipeline("analytics_stream_v1"))
    print(f"Task finished with status: {result.status} ({result.execution_time_ms}ms)")
\`\`\`

:::important[variant=info,title=Architecture Tip]
Keep worker processes stateless so you can horizontally scale your pipeline container across multiple replicas.
:::

### Key Features
- **Async Concurrency**: Non-blocking event loop execution.
- **Type Safety**: Strictly typed with Python dataclasses.
- **Error Boundaries**: Structured error capture without crashing the parent process.`,
  },
  {
    keywords: ["explain", "concept", "how", "what is", "analogy"],
    generate: (prompt: string) => `## Intuitive Explanation

Let's break down this concept clearly using a structured mental model.

### 1. The Core Analogy
Think of this like an **air traffic control system**:
- Rather than every airplane negotiating landing order individually, a centralized or consensus-driven coordinator maintains an agreed-upon sequence of events.
- If one communication frequency experiences interference, redundant channels instantly ensure no conflicting instructions are issued.

### 2. Step-by-Step Breakdown

1. **State Discovery**: Nodes broadcast their current state and verify agreement.
2. **Quorum Verification**: A strict majority must validate every state transition before it is committed.
3. **Fault Tolerance**: If up to \`f\` nodes fail in a system of \`2f + 1\` members, the system continues to operate safely without split-brain anomalies.

:::important[variant=info,title=Key Takeaway]
Distributed consensus solves the fundamental challenge of achieving unanimous agreement across unreliable networks without trusting any single central point of failure.
:::

Would you like to explore the failure edge cases or dive deeper into the implementation details?`,
  },
  {
    keywords: ["business", "market", "pricing", "strategy", "idea"],
    generate: (prompt: string) => `## Strategic Business & Feasibility Analysis

Here is a structured assessment for your query:

### 1. Market Opportunity & Value Proposition
- **Total Addressable Market (TAM)**: Growing rapidly at ~24% CAGR driven by enterprise AI adoption.
- **Core Value Wedge**: Replacing slow, manual, error-prone human processes with real-time autonomous verification.

### 2. Unit Economics Breakdown

| Dimension | Early Stage | Scaled Stage |
| :--- | :--- | :--- |
| **Customer Acquisition Cost (CAC)** | \$4,500 – \$8,000 | \$2,200 |
| **Annual Contract Value (ACV)** | \$25,000 | \$60,000+ |
| **Gross Margin** | 68% (higher cloud cost) | 82% (optimized model caching) |
| **Net Revenue Retention (NRR)** | 105% | 125% |

:::important[variant=warning,title=Competitive Moat Consideration]
Pure UI wrappers over third-party APIs have low defensibility. Build defensibility through proprietary domain data, deep workflow integrations, or specialized evaluation benchmarks.
:::

### 3. Recommended Next Steps
1. Conduct 15 discovery interviews with target buyers.
2. Build an interactive proof-of-concept to validate conversion rate.
3. Measure time-to-value (TTV) — target under 10 minutes for initial setup.`,
  },
];

export function getMockResponseForPrompt(prompt: string, mode: "auto" | "fast" | "balanced" | "reasoning") {
  const lower = prompt.toLowerCase();
  
  for (const template of MOCK_RESPONSE_TEMPLATES) {
    if (template.keywords.some((kw) => lower.includes(kw))) {
      return template.generate(prompt);
    }
  }

  // Fallback comprehensive response
  return `## Analysis & Overview

Thank you for your question. Here is a clear, actionable overview:

### Primary Considerations
1. **Scope Definition**: Clarify specific objectives and success criteria upfront.
2. **Iterative Execution**: Build with modular components to allow easy refactoring and testing.
3. **Observability**: Maintain clear logging, error tracing, and performance metrics.

:::important[variant=info,title=HaSa AI Note]
This is an interactive mock response running in **${mode.toUpperCase()} mode preview**. In subsequent phases, this will be powered by the Intelligent Model Router connecting to Groq, Gemini, and OpenRouter.
:::

### Recommended Action Plan
- [x] Step 1: Confirm design parameters and input constraints
- [x] Step 2: Establish an automated test suite
- [ ] Step 3: Deploy initial staging prototype

Let me know if you would like me to elaborate on any specific aspect!`;
}

