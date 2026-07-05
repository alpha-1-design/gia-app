# GIA App — Agent Guide

## Commands (order matters)
```bash
npm ci --legacy-peer-deps   # install (needs legacy flag)
npm run lint                # eslint . — must pass
npm run test:run            # vitest run (not watch)
npm run build               # tsc -b && vite build — typecheck THEN build
npm run dev                 # Vite dev server
npx cap sync android        # after build, for Android APK
```

## Architecture

**Single-page React 19 app** — not monorepo. No framework router.

| Layer | Key facts |
|-------|-----------|
| **Build** | Vite 8, `base: './'` (critical for Capacitor assets), `cssMinify: 'esbuild'` (avoids LightningCSS/Tailwind v4 conflict) |
| **Styling** | Tailwind CSS v4 (`@import "tailwindcss"`, no `tailwind.config.js`), `@tailwindcss/vite` plugin |
| **State** | Zustand 5 with `persist` middleware → IndexedDB via `src/store/idb-storage.ts` (debounces writes 300ms, flushes on `beforeunload`). Use `useShallow` from `zustand/react/shallow` for selector perf. |
| **Animation** | `motion` package (import from `motion/react`, NOT `framer-motion`) |
| **Path alias** | `@/` → `src/` |
| **Icons** | Lucide React |
| **Charts** | Recharts; Mermaid/KaTeX loaded from CDN on demand |

**8 modules** in `src/modules/`, registered in `src/App.tsx:52`. Analyst, Exam, Autonomy, Agents are lazy-loaded.

## Generation Pipeline

```
useChatState → useChatGeneration → GiaBrain.generate() → provider adapter → tool loop
```

### Streaming Flow

```
provider adapter XHR onprogress
  → SSE buffer (partialLine/partialEvent handles split TCP packets)
  → raw text delta → onStream(textDelta)    ← NO pre-processing here
  → useChatGeneration.ts onStream callback
    → sharedProcessStreamChunk(chunk, parserState)   ← single central parse
    → strips tool/think/json blocks, updates display
    → updateMessage(content, thoughts)
```

**Key rules:**
- Provider adapters (`openai.ts`, `anthropic.ts`, `gemini.ts`) send **raw** text deltas to `onStream`. They do NOT call `processStreamChunk` — only `useChatGeneration.ts` does that centrally.
- Each adapter has SSE partial-line buffering (`partialLine`/`partialEvent`) to handle chunks split across XHR packets, with flush on `onload`.
- The `updateMessageInTree` function in `useGiaStore.ts` does NOT set `thinking: false` on every update. The `finally` block in `useChatGeneration.ts` explicitly sets `thinking: false` after the stream finishes.
- Tool calls (native OpenAI `tool_calls`, Anthropic `tool_use`) are accumulated during streaming and flushed into `fullText` as ` ```tool ` blocks on `onload`.

### ForceJSON Flow (Analyst, Exam, Planner)

```
module → generateWithRetry<T>(generateFn)
  → GiaBrain.generate({ forceJson: true })
    → appends CRITICAL JSON-only instruction
    → temperature forced to 0.1
    → tool execution skipped
    → OutputValidator.validate(text)
    → extractJSON<T>(text) — 6 strategies
    → retry loop (4 attempts, delays 1s–10s)
  → parsed data or throw
```

- `GiaBrain` is a **singleton** (`src/services/GiaBrain.ts`). The tool execution loop runs max 10 iterations: model output → extract `` ```tool ``` blocks → execute (parallel-safe read tools batch, mutating tools sequential) → feed observations back → loop.
- Provider adapters: `src/services/providers/{openai,anthropic,gemini,local}.ts`.
- System prompt builder: `src/services/buildGiaSystem.ts` (~350 lines, merges identity, memories, profile, tools, custom instructions).
- Tools: `src/services/tools/` (35 files), registered in `src/services/GiaTools.ts`.
- `AbortController` for cancellation; generation survives module switches via `generationState` in store.

## Stores (`src/store/`)

All Zustand, persisted to IndexedDB. Key stores:
- `useGiaStore` — modules, sessions (tree-based messages), feature toggles, notifications
- `useProviderStore` — provider API keys, models
- `useMemoryStore` — persistent memory with relevance scoring
- `useAgentStore` — custom agents + per-agent RAG
- `useAutonomyStore` — autonomous goals/progress
- `useProtocolStore` — tool approval workflow
- `useMCPStore`, `useNotesStore`, `useTaskStore`, `usePluginStore`, `useSearchStore`

## Test Patterns

- **Vitest 4** with `globals: true`, `jsdom`, `jest-dom` matchers.
- Import from `'vitest'` explicitly (despite globals).
- Mock stores via `vi.mock()` with external mutable state variable reset in `beforeEach`.
- Mock IndexedDB storage with in-memory `Map`.
- Factory functions for test data (e.g. `makeTask()`, `userMsg()`).
- `vi.spyOn(globalThis, 'fetch')` for HTTP services.
- `vi.useFakeTimers()` for time-dependent tests.

## Module Theming

CSS variables in `src/styles/globals.css`:
```
--mod-chat: 168, 85, 247  (violet)
--mod-exam: 245, 158, 11  (amber)
--mod-analyst: 59, 130, 246 (blue)
--mod-writer: 236, 72, 153 (pink)
--mod-planner: 16, 185, 129 (emerald)
--mod-agents: 168, 85, 247 (violet)
--mod-autonomy: 52, 211, 153 (emerald)
--mod-settings: 148, 163, 184 (slate)
```

## Code Conventions

- Functional components + hooks only. No class components.
- TypeScript strict mode. Avoid `any`.
- Zod schemas for tool input validation.
- CSS variables for theming (`var(--gia-*)`), Tailwind utility classes for layout.
- Prefer Lucide icons; `clsx` for conditional classes.

## Key Services

| Service | Path | Role |
|---------|------|------|
| `GiaBrain` | `services/GiaBrain.ts` | Generation orchestrator, tool loop |
| `buildGiaSystem` | `services/buildGiaSystem.ts` | System prompt assembly |
| `ProviderRegistry` | `services/ProviderRegistry.ts` | Provider definitions |
| `ProviderMonitor` | `services/ProviderMonitor.ts` | Health tracking, smart fallback |
| `RAGService` | `services/RAGService.ts` | Vector search (local ONNX embeddings) |
| `LocalAI` | `services/LocalAI.ts` | On-device embedding/classification |
| `LocalLLMService` | `services/LocalLLMService.ts` | Local Qwen2.5 (0.5B–3B) via Transformers WASM |
| `OutputValidator` | `services/OutputValidator.ts` | Auto-repair malformed JSON/fences |
| `InputGuardrails` | `services/InputGuardrails.ts` | Prompt injection blocking |
| `ResponseCache` | `services/ResponseCache.ts` | Request dedup with TTL |
| `PluginManager` | `services/PluginManager.ts` | Hook-based plugin system |
| `MCPManager` | `services/MCPManager.ts` | MCP server lifecycle |
| `ToolRunner` | `services/brain/toolRunner.ts` | Tool execution with retry + protocol approvals |
| `SchedulerService` | `services/SchedulerService.ts` | Periodic background tasks |
| `MessagingBridge` | `services/MessagingBridge.ts` | Telegram/WhatsApp integration |
| `DesktopNotifications` | `services/DesktopNotifications.ts` | Browser notifications |
| `generateWithRetry` | `utils/generateWithRetry.ts` | JSON + network retry (Analyst/Planner/Exam) |
| `streamParser` | `utils/streamParser.ts` | `processStreamChunk`/`stripToolBlocks`/`flushThinkBlock` for streaming display |

## Server & Daemon

- `server/` — Sandbox (Python doc parser, browse_web), GIA Stdio Bridge.
- `daemon/` — Background gateway daemon (Node.js).
- `scripts/` — Alpine sandbox setup, sandbox helper.
- `android/` — Capacitor Android project.

## Settings & Connectors

- **Connectors** (`ConnectorManager`): Generic API connector configs (OpenWeather, GitHub, etc.). Each connector has `id`, `name`, `fields` schema. Configured in Settings → Connectors. Telegram was removed from this list — use **Social** section instead.
- **Social platforms** (`SocialManager`): Telegram, WhatsApp, Instagram, Twitter with OAuth/token auth. Configured in Settings → Social Media.
- **HuggingFace token**: Stored in `localStorage` under `gia:vision:hfToken`. UI in Settings → Developer. Has an explicit **Save** button.
- **Gateway routes** (`GatewaySection`): Route-based messaging configuration (incoming → action).

## Known Issues

- **Analyst/Exam/Planner JSON parsing**: These modules use `generateWithRetry<T>()` which expects strict JSON output. If the AI model doesn't follow instructions (e.g., Anthropic lacks native `forceJson`), parsing may fail. The system prompt instructs the AI for JSON-only output, but model behavior varies.
- **Local LLM download**: `@huggingface/transformers` `pipeline()` downloads models via CDN. Failures are logged but errors are captured and displayed in the UI card.
- **Camera**: User-facing "Camera" button in chat toolbar uses `@capacitor/camera` plugin (native) with web fallback to file picker.

## Landing Page

Located at `src/landing/` (separate Vite entry). Not deployed anywhere — marketing brochure site, not the actual app.

## Android APK

```bash
npm run build
npx cap sync android
npx cap open android  # opens Android Studio
```

Keystore generated in CI (`github.com/alpha-1-design/gia-app/actions`). Release APK ready to sideload from GitHub Releases.