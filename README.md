# HaSa AI — Frontend UI Foundation

**HaSa AI** is an intelligent multi-LLM chat workspace built with Next.js, React, TypeScript, and Tailwind CSS. It is designed to be provider-agnostic, preparing for dynamic model routing across **Groq**, **Google Gemini**, and **OpenRouter**.

---

## Features Implemented in Phase 1

- **Visual Design System**:
  - Deep charcoal dark-first theme (`#0c0e14`) with warm neutral light-theme toggle.
  - Electric violet and indigo accents (`#7c3aed`, `#6366f1`).
  - Strict 8px spacing system, rounded medium corners, accessible focus states.
- **Top Navigation Bar**:
  - Collapsible sidebar toggle button.
  - HaSa AI vector logo & wordmark with preview badge.
  - Global conversation search (`⌘K` / `Ctrl+K`).
  - Model mode selector (Auto, Fast, Balanced, Reasoning).
  - Dark / Light theme toggle.
  - User profile menu with preview tier badge.
- **Sidebar & Thread History**:
  - Grouped conversations: **Pinned**, **Today**, **Yesterday**, **Previous 7 Days**, **Older**.
  - Four realistic preloaded discussions:
    - *Building a RAG pipeline*
    - *Python data-cleaning assistant*
    - *Agricultural price dashboard*
    - *AI engineer portfolio ideas*
  - Interactive actions: New chat, Search, Rename, Pin/Unpin, and Delete with confirmation modal.
  - Collapses smoothly into an icon rail on desktop (280px → 64px).
  - Touch-friendly slide-over drawer on mobile devices.
- **Empty State**:
  - HaSa AI geometric brand icon.
  - Welcome title and capabilities description.
  - 4 interactive suggestion cards that load prompts into the workspace.
- **Message List & Assistant Capabilities**:
  - Realistic word-by-word / chunk-by-chunk mock streaming with a typing cursor.
  - Provider & model metadata tags (e.g., `⚡ HaSa Auto • Smart selection preview • 0.8s`).
  - Markdown rendering: headings, lists, tables with horizontal scrolling, and blockquotes.
  - Code blocks with language labels, copy buttons, line-number toggles, and copy-success states.
  - Custom `<ImportantContentCard />` callouts (Info, Warning, Success) with copy buttons.
  - Thumbs up/down feedback, message regeneration, continue generation, and message editing.
  - Scroll-to-bottom button when scrolled up.
- **Composer**:
  - Auto-growing multiline textarea (44px to 200px max height).
  - `Enter` to send, `Shift+Enter` for newline.
  - Cancelable streaming via "Stop" button.
  - File attachment button with file chips and drag-and-drop dropzone overlay.
  - Dynamic token estimation indicator (`~32 tokens`).
- **Dialogs**:
  - Global Search Modal (`⌘K`) with real-time filtering and arrow-key navigation.
  - Rename Conversation Modal.
  - Delete Conversation Confirmation Modal.
  - Settings Modal with theme switcher and model routing strategy overview.

---

## Getting Started

### Prerequisites
- Node.js 18.x, 20.x, or 22+ (tested on Node v24.15.0)
- npm or pnpm

### Installation

```bash
# Navigate to project directory
cd HaSa

# Install dependencies (if not already installed)
npm install
```

### Running Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm run start
```

---

## Component Architecture

```text
src/
├── types/
│   └── chat.ts                     # Core TypeScript models
├── context/
│   └── ChatContext.tsx             # Reactive state (conversations, streaming, dialogs)
├── lib/
│   ├── utils.ts                    # cn helper, formatters, token counter
│   ├── mock-data.ts                # Preloaded chats, response templates, model registry
│   └── mock-streamer.ts            # Realistic chunked stream simulator with AbortSignal
├── components/
│   ├── branding/
│   │   ├── HasaLogo.tsx            # Geometric vector SVG logo
│   │   └── HasaWordmark.tsx        # Typography wordmark with preview badge
│   ├── layout/
│   │   ├── AppShell.tsx            # Top-level shell orchestrating sidebar & workspace
│   │   ├── TopNav.tsx              # Header with search, mode selector & theme toggle
│   │   ├── Sidebar.tsx             # Desktop collapsible sidebar (expanded & icon rail)
│   │   └── MobileSidebar.tsx       # Touch-friendly drawer for mobile
│   ├── chat/
│   │   ├── ChatWorkspace.tsx       # Layout orchestrator
│   │   ├── ConversationHeader.tsx  # Editable title, status, pin, export, delete
│   │   ├── MessageList.tsx         # Scrollable message list with auto-scroll
│   │   ├── MessageItem.tsx         # Role dispatcher
│   │   ├── UserMessage.tsx         # User bubble, timestamp, edit & copy actions
│   │   ├── AssistantMessage.tsx    # Markdown, code blocks, callouts, streaming cursor
│   │   ├── MessageActions.tsx      # Copy, regenerate, continue, feedback toolbar
│   │   ├── CodeBlock.tsx           # Syntax highlighted block with line numbers & copy
│   │   ├── ImportantContentCard.tsx# Info/Warning/Success callout cards
│   │   └── EmptyChat.tsx           # Welcome screen with 4 suggested prompt cards
│   ├── composer/
│   │   ├── ChatComposer.tsx        # Multiline input, send/stop, token counter
│   │   ├── AttachmentButton.tsx    # File attachment selector & chip pills
│   │   └── ModeSelector.tsx        # Strategy dropdown (Auto, Fast, Balanced, Reasoning)
│   ├── dialogs/
│   │   ├── SearchDialog.tsx        # Global search modal (Cmd+K)
│   │   ├── RenameConversationDialog.tsx
│   │   ├── DeleteConversationDialog.tsx
│   │   └── SettingsDialog.tsx      # Theme & routing preferences
│   └── ui/
│       ├── toast.tsx               # Floating toast notifications
│       └── tooltip.tsx             # Accessible hover tooltips
└── app/
    ├── globals.css                 # Dark & light design system tokens
    ├── layout.tsx                  # Root layout
    └── page.tsx                    # Main entry page (Phase 2: live backend-backed workspace)
```

---

## Phase 2 — Secure Backend Foundation (Firebase + Mock Streaming)

Phase 2 connects the Phase 1 UI to a secure backend. **No real LLM providers are wired yet** —
all assistant responses come from a keyword-based `MockProvider` (`HaSa Mock / Preview Model`)
behind a provider-agnostic `LLMProvider` interface, ready for Groq/Gemini/OpenRouter in Phase 3.

### What was added

1. **Firebase client** (`src/lib/firebase/client.ts`) — browser SDK init, sign-in/out,
   auth-state subscription, ID-token helper. Never touches the Admin SDK.
2. **Firebase Admin** (`src/lib/firebase/admin.ts`) — server-only token verification +
   Firestore access. Escaped `\n` in `FIREBASE_ADMIN_PRIVATE_KEY` is handled.
3. **Auth UI + protected routes** — `/login`, `/signup`, `/forgot-password`, `AuthProvider`
   (`src/context/AuthContext.tsx`), `/` redirects to `/login` when signed out.
4. **Firestore data model** — `users/{uid}/conversations/{id}/messages/{id}`,
   `users/{uid}/saved-items/{id}`, `users/{uid}/preferences/main`. See `firestore.rules`.
5. **Conversation APIs** — `GET/POST /api/conversations`, `GET/PATCH/DELETE
   /api/conversations/:id`, `GET /api/conversations/:id/messages` (cursor pagination).
6. **Chat API** — `POST /api/chat` verifies user → validates (Zod) → checks ownership →
   saves user message → builds context → streams mock SSE (`metadata` → `token`* →
   `complete`/`error` → `[DONE]`) → persists the finished assistant message → updates
   conversation metadata. Incomplete streams are never saved as complete.
7. **Saved items + preferences** — `GET/POST /api/saved-items`, `PATCH/DELETE
   /api/saved-items/:id` (ownership of referenced conversation/message enforced),
   `GET/PUT /api/preferences`.
8. **Validation** (`src/lib/validation/`) — Zod schemas, trimmed inputs, length caps,
   mode/type whitelists. `400` with useful messages on failure.
9. **Errors** (`src/lib/server/errors.ts`) — consistent `{ error: { code, message,
   retryAfterMs? } }` shape; `400/401/403/404/429/500`. No stack traces in prod.
10. **Rate limiting** (`src/lib/server/rate-limit.ts`) — in-memory per-user buckets
    (chat 20/min, conversation/saved-item creation 30/min). Documented as
    **single-instance dev only**; swap the `RateLimiter` impl for Redis in production.
11. **Mock provider** (`src/lib/providers/`) — `LLMProvider` interface + keyword-based
    `MockProvider` (code / learning / business / data / general templates).
12. **Context builder** (`src/lib/context/conversation-context.ts`) — latest ≤20 messages,
    chronological, with a `summaryPlaceholder` reserved for Phase 3.
13. **Frontend API client** (`src/lib/api/`) — attaches ID tokens, parses `ApiError`,
    SSE streaming with AbortController (Stop button).
14. **Security** — `firestore.rules` (owner-only incl. nested subcollections), CSP +
    `X-Frame-Options: DENY` in `next.config.mjs`, `.env.example` placeholders only,
    `.gitignore` covers `.env*`.

### Setup

```bash
# 1. Install
npm install

# 2. Configure Firebase (console.firebase.google.com):
#    - Create project, enable Email/Password auth + Firestore
#    - Web app → copy client keys; Service account → generate key (Admin SDK)

# 3. Env
cp .env.example .env.local   # then fill in all values

# 4. Deploy rules (or paste firestore.rules in console → Rules → Publish)
#    npx firebase-tools deploy --only firestore:rules   # if using firebase-tools

# 5. Run
npm run dev        # http://localhost:3000
npm run build      # production check (tsc-clean required)
```

Emulator (optional): `firebase emulators:start --only auth,firestore`, then point the
client at `localhost` per Firebase docs and run the testing plan below against it.

### Testing plan (also valid against the emulator)

- [ ] Unauthenticated `GET /api/conversations` → `401 UNAUTHORIZED`.
- [ ] Request with forged/expired Bearer token → `401`.
- [ ] User A `GET /api/conversations/<user-B-conv-id>` → `404 CONVERSATION_NOT_FOUND`
      (no cross-user leakage; ownership derived from token, never client `userId`).
- [ ] `POST /api/conversations` `{ title, selectedMode }` → `201` + echoes doc.
- [ ] `PATCH` rename / pin / archive round-trips in sidebar + header.
- [ ] `DELETE` removes conversation **and** its messages subcollection.
- [ ] `POST /api/saved-items` with another user's conversationId → `400`.
- [ ] `POST /api/chat` with `{ message: "   " }` → `400`; oversized (>8000) → `400`;
      bad mode → `400`.
- [ ] Chat streams `metadata → token… → complete → [DONE]`; assistant message persists;
      conversation `messageCount` += 2 and preview updates.
- [ ] Mid-stream Stop (AbortController) → `error` path, no complete assistant doc saved.
- [ ] 21 rapid `POST /api/chat` within 60s → `429 RATE_LIMITED` + `Retry-After`.
- [ ] Firestore rules: sign in as A, try reading `/users/<B>/conversations/*` via SDK →
      denied; emulator rules coverage report shows owner-only allows + default deny.

### Files created / modified (Phase 2)

Created: `src/types/chat.ts` (extended), `src/lib/firebase/{client,admin,auth,firestore}.ts`,
`src/lib/server/{auth-middleware,errors,rate-limit,conversations}.ts`,
`src/lib/validation/{chat,conversation,saved-item}-schemas.ts`,
`src/lib/providers/{provider.interface,mock.provider}.ts`,
`src/lib/context/conversation-context.ts`, `src/lib/api/{client,conversations,messages,chat,saved-items}.ts`,
`src/context/AuthContext.tsx`, `src/components/auth/AuthForm.tsx`,
`src/app/{layout,page}.tsx`, `src/app/{login,signup,forgot-password}/page.tsx`,
`src/app/api/conversations/route.ts`, `src/app/api/conversations/[conversationId]/route.ts`,
`src/app/api/conversations/[conversationId]/messages/route.ts`, `src/app/api/chat/route.ts`,
`src/app/api/saved-items/route.ts`, `src/app/api/saved-items/[savedItemId]/route.ts`,
`src/app/api/preferences/route.ts`, `.env.example`, `firestore.rules`, `.gitignore`,
`next.config.mjs` (security headers), `package.json` (firebase, firebase-admin, zod, server-only).
Note: legacy `src/context/ChatContext.tsx` + `src/lib/mock-data.ts` (Phase 1 mocks) are
kept for compatibility; the live app now reads from the API instead.

### Remaining for Prompt 3 (real multi-LLM routing)

> ✅ DONE — implemented below as Phase 3.

---

## Phase 3 — Live Multi-LLM Routing (Groq + Gemini + OpenRouter + Nara)

`POST /api/chat` now streams from real providers through `HasaRouter`
(`src/lib/providers/router.ts`), which implements `LLMProvider` so the route
stays provider-agnostic. The mock remains as final fallback + `LLM_MOCK_ONLY` mode.

### Adapters (`src/lib/providers/`)

| File | Vendor | Protocol | Default model (env override) |
|---|---|---|---|
| `groq.provider.ts` | Groq | `groq-sdk`, SSE + `include_usage` | `openai/gpt-oss-20b` (`GROQ_MODEL`) |
| `gemini.provider.ts` | Google | `@google/generative-ai`, history→`user/model` turns + `systemInstruction` | `gemini-3.6-flash` (`GEMINI_MODEL`) |
| `openrouter.provider.ts` | OpenRouter | OpenAI SDK @ `openrouter.ai/api/v1` + attribution headers | `deepseek/deepseek-v4-pro-0813` (`OPENROUTER_MODEL`) |
| `nara.provider.ts` | NaraRouter | OpenAI SDK @ `router.bynara.id/v1` (per https://router.bynara.id/docs) | `auto/bynara` (`NARA_MODEL`) |
| `openai-compatible.ts` | shared | streaming core for OpenRouter/Nara | — |
| `routing-policy.ts` | pure | intent + chain ordering (no SDKs → unit-testable) | — |
| `index.ts` | registry | `getChatProvider()` / `describeChatProvider()` | `LLM_MOCK_ONLY=true` forces mock |

All keys are server-only (`process.env`, never `NEXT_PUBLIC_`, never sent to the client).
SDK retries are disabled (`maxRetries: 0`) — the router owns failover.

### Router policy

Keyword intent (`classifyIntent`: code / reasoning / research / business / general) +
mode chains (`chainForMode`):

- **fast** → Groq, Gemini, Nara, OpenRouter, mock
- **balanced** → Gemini, Groq, Nara, OpenRouter, mock
- **reasoning** → OpenRouter, Gemini, Nara, Groq, mock
- **auto** → code→Groq-first, reasoning→OpenRouter-first, research→Gemini-first,
  business/general→Nara-first, mock always last

Failover rule: switch providers only **before the first token**. A mid-stream
failure propagates as an `error` event instead — failing over mid-stream would fork
the transcript (client shows provider A, Firestore saves provider B). Unconfigured
providers (missing key) are skipped; `generate()` tries the whole chain in order.

Single-pass billing: `LLMRequest.telemetry` is filled by the serving provider during
`stream()` (identity + token usage), so the route persists results without a second
`generate()` call. Empty responses are rejected (`error` event, nothing persisted) —
this matters for thinking models, which return empty text when the output budget is
starved (verified live on Gemini; hence no `maxOutputTokens` caps anywhere).

### Verification (all run, 19 Sep 2026)

- `npm run test:router` — 8/8 checks (intent, chains, telemetry, fallback, all-fail).
- `npx tsc --noEmit` — clean. `npm run build` — green.
- `npm run check:providers` (live, shape-only output):
  - groq OK · gemini OK · openrouter OK (446 entitled) · nara 403 `telegram_required`.
- API smoke: unauthenticated `POST /api/chat` → 401, `/login` → 200.

### Operator action items

1. **Nara**: bind Telegram at router.bynara.id/settings (account returns
   `403 telegram_required` until then). Nara sits in every chain but is skipped on
   failure, so chat works without it.
2. **Firebase Admin**: still needs the service-account `CLIENT_EMAIL` + `PRIVATE_KEY`
   in `.env.local` — until then all `/api/*` calls 401 and chat can't run end-to-end.
3. **Rotate the provider keys** — they were shared in chat; regenerate after setup.
4. Model defaults were corrected against live `/models` (2.5-flash is retired for new
   users; llama-3.3-70b/claude-3.5-sonnet aren't on your entitlements). Re-run
   `npm run check:providers -- --ids` if you want to change tiers.

### Files created / modified (Phase 3)

Created: `src/lib/providers/{groq,gemini,openrouter,nara,openai-compatible,routing-policy,index}.ts`,
`scripts/{smoke-router.ts,live-provider-check.mjs}`.
Modified: `provider.interface.ts` (+`label`/`configured`/`telemetry`), `mock.provider.ts`
(+telemetry), `router.ts` (policy moved to `routing-policy.ts`), `src/app/api/chat/route.ts`
(single-pass live streaming + latency), `src/app/page.tsx` (server latency badge, live
footer), `ConversationHeader.tsx` + `mock-data.ts` (live provider labels), `.env.example`
(placeholders only — verified 0 secret lines), `.env.local` (gitignored), `package.json`
(`groq-sdk`, `openai`, `@google/generative-ai`, `tsx`, `test:router` + `check:providers`).

### Left for future work

- Conversation summarization (`summaryPlaceholder`) + token-budget truncation.
- Redis-backed `RateLimiter` for multi-instance production.
- RAG via Nara `/v1/embeddings` + `/v1/rerank` (already documented, same key).
- Firebase Storage attachments + `usage` tracking docs.

---

## Phase 4 — Free-Only Models + Responsive Premium UI

### Free-only model policy

Every default is a verified-free entitlement (checked live via `/models`):

| Provider | Default(s) | Env override |
|---|---|---|
| Groq | `openai/gpt-oss-20b` | `GROQ_MODEL` |
| Gemini | `gemini-3.6-flash` | `GEMINI_MODEL` |
| OpenRouter | 3-model `:free` chain: `deepseek/deepseek-v4-flash-0731:free` → `qwen/qwen3.8-27b:free` → `z-ai/glm-5.2:free` | `OPENROUTER_MODELS` (comma-separated) |
| Nara | `agnes-2.5-flash` → `laguna-s-2.1` → `ling-3.0-flash-sante-free` | `NARA_MODELS` |

`createOpenAICompatibleProvider` now accepts an ordered model list with
in-adapter failover (same before-first-token rule as the router, so transcripts
can't fork). Precedence: `*_MODELS` list → legacy single `*_MODEL` → built-ins.
`npm run check:providers -- --free` lists all entitled `:free` ids;
`--ids` dumps candidates. First chain head verified serving live.

### Responsive layout (mobile + desktop, automatic)

- Sidebar is a **slide-over drawer** (`86vw`, backdrop blur, close button) below `md`,
  and the existing collapsible rail on desktop — one component, breakpoint-driven.
- Saved-highlights panel is an **overlay sheet** below `lg`, side rail above.
- `h-dvh` + `env(safe-area-inset-bottom)` composer padding for mobile browsers;
  ModeSelector dropdown anchors right on small screens; toast goes full-width on xs.
- Conversation switching / new chat auto-closes the drawer.

### Premium feel

- `tailwindcss-animate` added, enabling the `animate-in` micro-motion already in the
  codebase (dropdowns, drawers, dialogs, toasts, suggestion cards with stagger).
- Ambient gradient orbs (`.ambient-bg`), shimmer skeletons for conversation/message
  loading, `message-enter` rise-in, composer focus glow, gradient send button with
  press physics, glowing empty-state brand mark.

### Files (Phase 4)

Modified: `openai-compatible.ts` (model-list failover), `openrouter/nara.provider.ts`,
`routing-policy.ts` (`parseModelList`), `src/app/page.tsx` (drawer, overlay panel,
skeletons, composer), `MessageList.tsx`, `EmptyChat.tsx`, `ModeSelector.tsx`,
`AuthForm.tsx`, `forgot-password`, `globals.css`, `tailwind.config.ts`,
`.env.local` / `.env.example` (free defaults), `mock-data.ts` (accurate labels).
Created: none beyond Phase 3 scripts (`--free`/`--ids` flags added to live check).
Verified: `test:router` 9/9, `tsc` clean, `build` green, API smoke (401/200),
`.env.example` secret-free, OpenRouter `:free` head serves live.

---

## Phase 5 — Mission Control (Admin) + Motion System + Identity

### Admin panel (`/admin`)

Cookie-gated area (HMAC-signed `HttpOnly` session, 12h, login rate-limited
10/10min per IP). Credentials live in gitignored `.env.local` only
(`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`) and are compared
timing-safe; **change the password after setup** since it passed through chat.

- `/admin/login` — motion login card; `/admin` — dashboard with animated tab bar
  (`layoutId` pill), staggered tables, animated counters, spring drawers.
- **Users**: paginated list (email, UID, created, last sign-in, counts) with filter,
  delete-user (Firestore subtree + Auth record, confirmed), jump-to-conversations.
- **Conversations**: per-UID browser, read-only transcript drawer, delete with confirm.
- **Email**: single or broadcast (≤500, individually addressed) via SMTP env
  (`SMTP_HOST/PORT/USER/PASS/FROM`); UI shows a config badge when unset.
- **Storage**: totals + per-user bars (conversations/messages/saved, conservative
  byte estimates labelled as such) + cleanup actions.
- All admin APIs fail safe (401 logged-out, 5xx without Firebase Admin) and the
  dashboard shows a banner when Admin SDK is unreachable.

Verified live: wrong creds → 400, no cookie → 401, real login → 200 + session
returns the admin email, `/admin/login` → 200.

### Motion system (`src/components/motion/Reveal.tsx`, framer-motion)

`FadeUp`, `Stagger`/`StaggerItem` (incl. `tbody`/`tr` support), `AnimatedCounter`,
plus `AnimatePresence` drawers/backdrops/toasts/errors on the main workspace,
floating brand mark, physics buttons (`whileHover`/`whileTap`), spring transcript
drawer and tab pill in Mission Control. Transform/opacity-only; honors
`prefers-reduced-motion` for CSS motion.

### New HaSa mark

`HasaLogo` redesigned (same props): gradient neural-nexus shell, orbit track with
animated satellite, breathing core, per-instance gradient IDs (no collisions);
`src/app/icon.svg` gives the app a real favicon.

### Developer identity (`src/lib/context/identity.ts`)

- `IDENTITY_PREAMBLE` is prepended as a system message on **every** chat request,
  so all vendors answer consistently — and only when asked.
- Mock provider triggers `IDENTITY_HYPE_RESPONSE` (Haneef tribute + **HaSa stands
  for HaneefSamrat** 👑) via `matchesIdentityQuery`; silence otherwise.
- Covered in `test:router` (now 10/10): trigger cases, non-trigger cases, hype
  content, silence check.

### Files (Phase 5)

Created: `lib/server/{admin-auth,admin-helpers}.ts`, `lib/email/mailer.ts`,
`lib/context/identity.ts`, `components/motion/Reveal.tsx`,
`app/admin/{login/page,page}.tsx`, `app/api/admin/{login,session,users,users/[uid],users/[uid]/conversations,users/[uid]/conversations/[cid],email,storage}/route.ts`,
`app/icon.svg`. Modified: `mock.provider.ts`, `api/chat/route.ts` (preamble),
`HasaLogo.tsx`, `EmptyChat.tsx`, `page.tsx`, `AuthForm.tsx`, `.env.*`,
`package.json` (`nodemailer`, `@types/nodemailer`).
Verified: `test:router` 10/10, `tsc` clean, `build` green, admin auth E2E.

---

## Phase 6 — Spec Multi-LLM Platform (registry, scoring router, usage)

This phase rebuilt the LLM layer onto the provider-agnostic spec while keeping
every prior behavior (free-only defaults, mock fallback, identity preamble).

### Supported providers

| Provider | Module | Protocol | Free default(s) |
|---|---|---|---|
| Groq | `providers/groq.provider.ts` | `groq-sdk`, SSE usage | `openai/gpt-oss-20b` |
| Gemini | `providers/gemini.provider.ts` | `@google/generative-ai`, turns + system instruction | `gemini-3.6-flash` |
| OpenRouter | `providers/openrouter.provider.ts` | OpenAI-compatible + attribution headers | 3-model `:free` chain |
| NaroRouter | `providers/narorouter.provider.ts` | OpenAI-compatible, configurable base URL | `agnes-2.5-flash` chain |

Shared core: `provider.types.ts` (spec interfaces), `provider-errors.ts`
(transient/permanent classification, timeouts, friendly messages),
`provider-registry.ts` (registration, model lookup, 60s-cached health),
`openai-compatible.ts` (OpenRouter/NaroRouter transport).

### Environment variables (all server-only; see `.env.example`)

Keys: `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `NAROROUTER_API_KEY`
(legacy `NARA_ROUTER_API_KEY` still honored). Models: `GROQ_FAST_MODEL`,
`GROQ_CODING_MODEL`, `GEMINI_FAST_MODEL`, `GEMINI_REASONING_MODEL`,
`GEMINI_LONG_CONTEXT_MODEL`, `OPENROUTER_GENERAL/CODING/REASONING_MODEL`,
`OPENROUTER_MODELS` (ordered free chain), `NAROROUTER_BASE_URL`,
`NAROROUTER_GENERAL_MODEL` (legacy `NARA_*` honored). Tuning:
`LLM_REQUEST_TIMEOUT_MS` (default 60000, enforced on every request),
`LLM_MAX_RETRIES`, `LLM_MOCK_ONLY=true` (mock mode). `config/env.ts` validates
at startup with warnings only — the app always boots; unconfigured providers
are skipped and the UI shows them disabled.

### Automatic routing (`routing/`)

`task-classifier.ts` (deterministic signals → task + confidence, low confidence
collapses to `general`) → `model-router.ts` (`selectModel`: enabled/streaming/
context filters → transparent scoring → primary + ordered fallbacks + safe
reason string) → `fallback-manager.ts` (transient-only failover, pre-token
switching only, `FallbackMetadata`). Modes: fast/balanced/reasoning/auto with
capability + speed/quality biases. Manual `requestedModel` is validated against
the enabled registry and wins when available.

### Fallback, streaming, usage

- Normalized SSE: `metadata` (provider, model, mode, task) → `token`* →
  `complete` (usage, final provider/model, `fallbackUsed`) / `error`
  (`code`, friendly message, `retryable`) → `[DONE]`.
- Only the final response is persisted, with routing metadata
  (task, fallback chain, latency, manual flag); per-request usage goes to
  `users/{uid}/usage/{id}` plus a lightweight user aggregate (counts only —
  no billing math).
- Route guards: auth, ownership, Zod (incl. `requestedModel`), rate limits,
  one live generation per conversation (409 on duplicates), client-disconnect
  abort propagation, empty-response rejection.
- `GET /api/models` (safe metadata, disabled models included as disabled) and
  `GET /api/providers/health` (auth, cached, sanitized) power the model
  selector and the Providers dialog. Keys never reach the browser (verified by
  response-shape review + secret scan of `.env.example`).

### Frontend additions

`ModelSelector` (Auto + manual grouped models, capability/speed/quality chips,
unavailable shown disabled), `ProviderStatusDialog` (health, latency, enabled
models), assistant badge with task tooltip + `fallback` chip, phase indicator
(selecting/streaming/from-provider), fallback toast, friendly retryable errors.

### How to add a provider

1. Create `providers/<name>.provider.ts` implementing `LLMProvider`
   (`generate`/`stream`/`healthCheck`/`getModels`) using `ProviderError` +
   `withTimeout`; keep vendor mapping inside the adapter.
2. Add env keys + model IDs to `config/env.ts` + `config/model-config.ts`
   (empty IDs are auto-filtered).
3. Register in `providers/index.ts`. 4. Add cases to `test:router`.
No other code changes needed — router, fallback, chat route and UI pick it up.

### Run modes

- One provider: set only its key — everything else disables itself.
- Mock mode: `LLM_MOCK_ONLY=true` or no keys at all.
- Troubleshooting: `npm run check:providers [--free|--ids]` for live key/model
  status; `npm run test:router` for 11 router checks; `/api/providers/health`
  in-app; server logs never contain prompts, responses, or keys.

### Files (Phase 6)

Created: `providers/{provider.types,provider-errors,provider-registry,narorouter.provider}.ts`,
`config/{env,model-config}.ts`, `routing/{task-classifier,routing-rules,model-router,fallback-manager}.ts`,
`usage/{usage.types,usage-tracker}.ts`, `api/{models/route,providers/health/route}.ts`,
`lib/api/models.ts`, `components/{composer/ModelSelector,settings/ProviderStatusDialog}.tsx`.
Rewritten: `groq/gemini/openrouter/openai-compatible` adapters,
`providers/{router(index)}`, `api/chat/route.ts`, `scripts/smoke-router.ts`.
Verified: `test:router` 11/11, `tsc` clean, `build` green (after `.next` cache
clear), live `check:providers` (groq/gemini/openrouter reachable, nara needs
Telegram bind), `/api/models` + `/api/providers/health` 401-gated, secret scans
clean (`src/` + `.env.example` contain zero key material).

---

## Phase 7 — Provider Picker, Premium Font, Storage Manager

- **Provider-only selection**: the composer has a provider button (Groq default;
  Gemini / OpenRouter / NaroRouter in an upward dropdown). The API takes
  `requestedProvider` (validated; unavailable provider → clear 400), scores the
  best enabled model inside that provider, and still fails over across vendors.
  Raw model IDs are never shown to users.
- **Typography**: Plus Jakarta Sans (UI) + JetBrains Mono (code) via
  `next/font`, pre-paint light-theme init, remembered theme toggle.
- **Storage manager**: used-vs-available quota bar (default 1 GiB Spark,
  `FIREBASE_QUOTA_BYTES` override), per-collection breakdown
  (messages/conversations/saved-items/usage), per-user footprint, one-click
  purge of regenerable `usage` analytics (`POST /api/admin/storage`, usage only).
- **Email**: still needs SMTP (no free sender exists without an account) — the
  admin Email tab now has a 3-minute Gmail App-Password guide; badge turns green
  once configured.
- Verified: `test:router` 13/13, `tsc` clean, `build` green, chat + purge
  endpoints auth-gated (401).

---

## Phase 8 — Diagnosis Sprint, Admin API Section, Gmail Handoff

### What was actually broken (proven by live end-to-end tests, not guesses)

New `npm run diag:chat` (creates a test Firebase user, mints a real ID token,
streams one message, reports time-to-first-token + serving provider) found:
1. **Groq total failure** — the SDK method was called unbound (`this` lost),
   throwing on every stream. One-line `.bind` fix; Groq now serves.
2. **NaroRouter missing from the registry** — its model block had been deleted
   from `model-config.ts`; restored (agnes → laguna → ling free chain).
3. **Stall-forever hangs** — keepalive dribbles defeat idle timers, so each
   model attempt now also has a wall-clock budget (`LLM_MODEL_BUDGET_MS`,
   default 120s) plus a 25s stream-start cap. Worst case is bounded and fails
   over instead of hanging.
4. **Slow first tokens** — every chat awaited 4 provider health checks first;
   the hot path now uses cached health + background refresh (never blocks).
5. **Repaired `FIREBASE_ADMIN_PRIVATE_KEY`** (was single-line + quoted) and a
   `diag:chat` argv bug along the way.
- Known account-level limits (not code): Gemini free tier 429s after 20/day;
  NaroRouter needed Telegram binding (done).

### Admin API section (`/admin` → API tab, `GET/PUT /api/admin/api-config`)

Per-provider **key + models** (plus NaroRouter base URL), stored in Firestore
`admin/provider-config` and effective for new chats immediately. Precedence:
Firestore override → env → built-ins. GET returns presence/models only —
keys never reach the browser (verified live); per-key format hints produce
warnings, not failures; per-provider "revert to .env" clears overrides.
`firestore.rules` denies all client access to `admin/**` and `usage/**`.

### Email handoff

SMTP still needs an account (Gmail App-Password guide is inline), but when
unconfigured the Email tab now offers **Continue in Gmail** (prefilled compose
window) + `mailto:` fallback using the draft's to/subject/body.

### Per-message provider picker

Composer provider button (Groq default) sends `requestedProvider`, validated
server-side against enabled providers; unavailable → clear 400. Raw model IDs
stay server-side only.

Verified: `test:router` 14/14, `tsc` clean, `build` green, admin login →
api-config GET (no leak) → PUT round-trip live, chat + storage + purge 401-gated.

---

## Phase 9 — Reliability Sprint, Left-Nav Admin, Gmail Handoff

Diagnosis (live e2e harness `npm run diag:chat`): Groq SDK method called
unbound (fixed), NaroRouter restored to registry (agnes single default),
per-model wall-clock budgets + 25s stream-start cap added so stalls fail over
instead of hanging, health moved off the hot path (cached + background).
- **Gemini**: free tier 429s after 20/day — added `gemini-3.5-flash-lite` as
  automatic fallback (separate quota, verified serving) + a 5-minute
  429 circuit breaker (`routing/circuit.ts`) so blown models are skipped
  without burning more quota; health checks use quota-free `countTokens`.
- **Latency note**: dev-mode first hits include route compilation (~15s);
  warm provider times are Groq ~1s, Nara ~3–14s, Lite ~5s. Use the production
  build for real speed figures.
- **Admin**: left-sidebar navigation with the **API Keys** section second;
  runtime key+model overrides apply instantly (registry + health invalidated on
  save — no restart); Email tab gains **Continue in Gmail** prefilled compose
  + mailto fallback when SMTP is unset.
- **Composer**: provider-only picker (Groq default), premium font stack.
- Verified: `test:router` 15/15, `tsc` clean, `build` green.

