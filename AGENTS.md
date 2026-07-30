# GIA App — Agent Guide

## Commands (order matters)
```bash
npm ci --legacy-peer-deps   # install (needs legacy flag)
npm run lint                # eslint . — must pass
npm run test:run            # NODE_OPTIONS='--experimental-require-module' vitest run
npm run build               # tsc -b && vite build — typecheck THEN build
npm run dev                 # launches sandbox server then Vite on :3000
npx cap sync android        # after build, for Android APK
```

## Architecture

**Single-page React 19 app** — not monorepo. No framework router.

| Layer | Key facts |
|-------|-----------|
| **Build** | Vite 8, `base: './'` (critical for Capacitor assets), `cssMinify: 'esbuild'` (avoids LightningCSS/Tailwind v4 conflict) |
| **Styling** | Tailwind CSS v4 (`@import "tailwindcss"`, no `tailwind.config.js`), `@tailwindcss/vite` plugin (excluded during `VITEST`) |
| **State** | Zustand 5 with `persist` middleware → IndexedDB via `src/store/idb-storage.ts` (debounces writes 300ms, flushes on `beforeunload`/`pagehide`/`freeze`/Capacitor `appStateChange`). Use `useShallow` from `zustand/react/shallow` for selector perf. |
| **Animation** | `motion` package (import from `motion/react`, NOT `framer-motion`) |
| **Path alias** | `@/` → `src/` |
| **Icons** | Lucide React |
| **Charts** | Recharts; Mermaid/KaTeX loaded from CDN on demand (also in package.json for types) |
| **Themes** | `dark` (default), `light`, `obsidian-aurora` — set via `data-theme` attr on `<html>` |

**8 modules** in `src/modules/` — Chat, Writer, Planner, Settings are eagerly loaded; Analyst, Exam, Autonomy, Agents are lazy. `DashboardModule.tsx` exists but is **not** registered in `App.tsx`.

**Dev server** (`npm run dev`): `node server/sandbox-server.cjs & vite --port=3000 --host=0.0.0.0`. Vite proxies `/api/sandbox` → `http://localhost:3081`.

**Tests**: Vitest 4 with `globals: true`, `jsdom`, `setupFiles: ./src/test/setup.ts`. IndexedDB and AudioContext are mocked. `tsconfig.app.json` excludes `src/test` — tests are NOT typechecked during `npm run build`.

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
- `updateMessageInTree` in `useGiaStore.ts` does NOT set `thinking: false` on every update. The `finally` block in `useChatGeneration.ts` explicitly sets `thinking: false` after the stream finishes.
- Tool calls (native OpenAI `tool_calls`, Anthropic `tool_use`) are accumulated during streaming and flushed into `fullText` as `` ```tool `` blocks on `onload`.

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
- System prompt builder: `src/services/buildGiaSystem.ts` (~650 lines, merges identity, memories, profile, tools, custom instructions).
- Tools: `src/services/tools/` (~45 tool modules), registered in `src/services/tools/index.ts` via `registerAllTools()` called at app startup.
- `AbortController` for cancellation; generation survives module switches via `generationState` in store.
- `CapacitorHttp: { enabled: false }` in `capacitor.config.ts` — critical for streaming (Android native HTTP bridge buffers full response, breaking incremental progress).

## Stores (`src/store/`)

All Zustand, persisted to IndexedDB via `idbStorage`. Key stores:
- `useGiaStore` — modules, sessions (tree-based messages), feature toggles, notifications, UI state
- `useProviderStore` — provider API keys, models, health
- `useMemoryStore` — persistent memory with relevance scoring
- `useAgentStore` — custom agents + per-agent RAG
- `useAutonomyStore` — autonomous goals/progress
- `useProtocolStore` — tool approval workflow
- `useMCPStore`, `useNotesStore`, `useTaskStore`, `usePluginStore`, `useSearchStore`
- Others: `useKnowledgeGraphStore`, `useGiaIdentity`, `useNexusStore`, `useMoodStore`, `useFileStore`, `useDraftStore`, `useWriterStore`, `useSyncStore`, `useTwinStore`, `useAutomationStore`, `useSearchActivity`, `useSummarizationStore`, `useNotificationStore`

## Test Patterns

- **Vitest 4** with `globals: true`, `jsdom`, `jest-dom` matchers, `setupFiles: ./src/test/setup.ts`.
- Import from `'vitest'` explicitly (despite globals).
- Mock stores via `vi.mock()` with external mutable state variable reset in `beforeEach`.
- Mock IndexedDB storage with in-memory `Map` (see `src/test/setup.ts`).
- Factory functions for test data (e.g. `makeTask()`, `userMsg()`).
- `vi.spyOn(globalThis, 'fetch')` for HTTP services.
- `vi.useFakeTimers()` for time-dependent tests.

## Module Theming

CSS variables in `src/styles/globals.css`:
```
--mod-chat:     168, 85, 247  (violet)
--mod-exam:     245, 158, 11  (amber)
--mod-analyst:  59, 130, 246  (blue)
--mod-writer:   236, 72, 153  (pink)
--mod-planner:  16, 185, 129  (emerald)
--mod-agents:   168, 85, 247  (violet)
--mod-autonomy: 52, 211, 153  (emerald)
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
| `ToolExecutionService` | `services/ToolExecutionService.ts` | Full tool orchestration |
| `ToolRegistry` | `services/ToolRegistry.ts` | Tool definition registration |
| `ProviderService` | `services/ProviderService.ts` | Provider selection + routing |
| `ErrorHandlingService` | `services/ErrorHandlingService.ts` | Generation error recovery |
| `SchedulerService` | `services/SchedulerService.ts` | Periodic background tasks |
| `MessagingBridge` | `services/MessagingBridge.ts` | Telegram/WhatsApp integration |
| `DesktopNotifications` | `services/DesktopNotifications.ts` | Browser notifications |
| `generateWithRetry` | `utils/generateWithRetry.ts` | JSON + network retry (Analyst/Planner/Exam) |
| `streamParser` | `utils/streamParser.ts` | `processStreamChunk`/`stripToolBlocks`/`flushThinkBlock` for streaming display |

## Server & Daemon

- `server/` — Sandbox server (`sandbox-server.cjs` on port 3081), Python doc parser, browse_web, GIA Stdio Bridge.
- `daemon/` — Background gateway daemon (Node.js).
- `scripts/` — Alpine sandbox setup, sandbox helper.
- `android/` — Capacitor Android project.

## Settings & Connectors

- **Connectors** (`ConnectorManager`): Generic API connector configs (OpenWeather, GitHub, etc.). Each connector has `id`, `name`, `fields` schema. Configured in Settings → Connectors.
- **Social platforms** (`SocialManager`): Telegram, WhatsApp, Instagram, Twitter with OAuth/token auth. Configured in Settings → Social Media.
- **HuggingFace token**: Stored in `localStorage` under `gia:vision:hfToken`. UI in Settings → Developer. Has an explicit **Save** button.
- **Gateway routes** (`GatewaySection`): Route-based messaging configuration (incoming → action).

## Known Issues

- **Analyst/Exam/Planner JSON parsing**: These modules use `generateWithRetry<T>()` which expects strict JSON output. If the AI model doesn't follow instructions (e.g., Anthropic lacks native `forceJson`), parsing may fail. The system prompt instructs the AI for JSON-only output, but model behavior varies.
- **Local LLM download**: `@huggingface/transformers` `pipeline()` downloads models via CDN. Failures are logged but errors are captured and displayed in the UI card.
- **Camera**: User-facing "Camera" button in chat toolbar uses `@capacitor/camera` plugin (native) with web fallback to file picker.

## Landing Page

Located at `src/landing/` (separate Vite entry with `landing.html`). GitHub Pages deploy swaps `cp landing.html index.html` before build — so `dist/` has the landing page content, not the app. App entry is `index.html`.

## Android APK

```bash
npm run build
npx cap sync android
npx cap open android  # opens Android Studio
```

Keystore generated in CI (`github.com/alpha-1-design/gia-app/actions`). Release APK ready to sideload from GitHub Releases. CI requires Java 21 + Android SDK (see `.github/workflows/build-apk.yml`).
