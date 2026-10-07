# GIA App — Agent Guide

## Commands

Exact order for validation (CI mirrors this):

```bash
npm ci --legacy-peer-deps   # install with legacy peer deps
npm run lint                # eslint .
npm run test:run            # vitest run (NODE_OPTIONS --experimental-require-module)
npm run build               # tsc -b && vite build (typecheck THEN build)
npm run dev                 # starts sandbox server + Vite :3000
npx cap sync android        # after build for Android
```

Single-test: `npm run test:run -- src/path/to/test.test.ts`

## Architecture (must know)

- **SPA (React 19)**, no framework router. Entry: `src/App.tsx`. Modules: Chat/Writer/Planner/Settings eager; Analyst/Exam/Autonomy/Agents lazy. `DashboardModule` exists but not registered. Build Studio lives in `src/modules/BuildModule.tsx`.
- **Vite 8**: `base: './'` (Capacitor), `cssMinify: 'esbuild'` (Tailwind v4), Tailwind v4 via `@tailwindcss/vite` (excluded in Vitest). Path alias `@/` → `src/`.
- **State**: Zustand 5 with `persist` to IndexedDB (`src/store/idb-storage.ts`, 300ms debounce, flush on `beforeunload/pagehide/freeze/Capacitor appStateChange`). Use `useShallow` for selectors.
- **Dev**: `npm run dev` runs `node server/sandbox-server.cjs & vite --port=3000 --host=0.0.0.0`. Vite proxies `/api/sandbox` → `http://localhost:3081`. Sandbox rootfs may be missing in some environments; the server refuses unsafe host fallback.
- **Themes**: `dark` (default), `light`, `obsidian-aurora` via `data-theme` on `<html>` (module color vars in `src/styles/globals.css`).

## Generation & Streaming

Flow: `useChatState → useChatGeneration → GiaBrain.generate() → provider adapter → tool loop`

- **Centralized streaming**: Provider adapters (`openai/anthropic/gemini/local.ts`) send **raw** text deltas to `onStream`; only `src/hooks/useChatGeneration.ts` calls `sharedProcessStreamChunk` (`processStreamChunk` from `utils/streamParser.ts`). 
- **SSE buffering**: Each adapter buffers partial lines/events (`partialLine/partialEvent`) across XHR chunks and flushes on `onload`.
- **Abort/cleanup**: Stream watchdog (`src/services/providers/streamWatchdog.ts`) enforces idle/first-byte timeouts; `finally` sets `thinking: false` on the message (store does not force it on every delta).
- **ForceJSON** (Analyst/Exam/Planner): `generateWithRetry<T>()` appends JSON-only instruction, forces `temperature=0.1`, skips tools, validates/repairs via `OutputValidator`, extracts via `extractJSON<T>` (6 strategies), retries up to 4 times.

## Providers & Registry

- `src/services/ProviderRegistry.ts` defines providers (OpenCode Zen default `deepseek-v4.1-flash`), fallback model catalogs, aliases.
- `src/services/brain/ResilientRelay.ts`: prefers **same-provider model failover** first (never cross-provider by default); falls back to different providers only if same-provider exhausted. Health-based ranking via `ProviderMonitor`.
- **CapacitorHttp disabled** in `capacitor.config.ts` (native bridge buffers full responses, breaks incremental streaming).

## Tool System

- Tools registered via `src/services/tools/index.ts` (`registerAllTools()` at startup). ~45 tool modules in `src/services/tools/`.
- Execution: `src/services/brain/toolRunner.ts` (timeout 120s, retry logic) + `ToolExecutionService`/`ToolRegistry`. Max 10 tool iterations in `GiaBrain` loop. Protocol approvals via `useProtocolStore`.
- `GiaBrain` is a singleton (`src/services/GiaBrain.ts`).

## Key Services (high signal)

| Service | Path | Purpose |
|---|---|---|
| GiaBrain | `services/GiaBrain.ts` | Orchestrator + tool loop |
| buildGiaSystem | `services/buildGiaSystem.ts` | System prompt assembly |
| generateWithRetry | `utils/generateWithRetry.ts` | JSON + retry (forceJSON flows) |
| streamParser | `utils/streamParser.ts` | `processStreamChunk`/`stripToolBlocks`/flush think blocks |
| OutputValidator | `services/OutputValidator.ts` | Repair malformed JSON/fences |
| ProviderRegistry/Monitor | `services/ProviderRegistry.ts`, `services/ProviderMonitor.ts` | Model catalogs + health |
| RAGService/LocalLLM | `services/RAGService.ts`, `services/LocalLLMService.ts` | Local embeddings/LLMs (Transformers WASM) |
| MCPManager | `services/MCPManager.ts` | MCP lifecycle (OAuth `gia://mcp-oauth-callback`) |
| TerminalService | `services/TerminalService.ts` | Native shell + smart timeouts |
| OrbAssistant/OrbControl | `services/OrbAssistant.ts`, `services/tools/orbControl.ts` | Floating Android orb actions |

## Stores

Zustand + IndexedDB. Core: `useGiaStore`, `useProviderStore`, `useMemoryStore`, `useAgentStore`, `useAutonomyStore`, `useProtocolStore`, `useMCPStore`, `useTaskStore`, `useNotesStore`, `usePluginStore`, `useFileStore`. Many others under `src/store/`.

## Tests

Vitest 4, `globals: true`, `jsdom`, `setupFiles: ./src/test/setup.ts`. Mocks IndexedDB/AudioContext in setup. Explicitly import from `vitest`. Use factories + `vi.spyOn`/`vi.useFakeTimers()`.

## Monorepo/multi-package notes

Single package (not monorepo). 8 modules in `src/modules/`; lazy-loaded ones: Analyst/Exam/Autonomy/Agents. Entry points: `index.html` (app), `landing.html` (landing page, GitHub Pages copies landing.html → index.html).

## Android/Capacitor

After `npm run build`, run `npx cap sync android && npx cap open android`. `capacitor.config.ts`: `CapacitorHttp.enabled = false` (critical for streaming).

## Conventions

- Functional components + hooks only. TypeScript strict. Zod for tool inputs. Avoid `any`.
- Tailwind v4 utilities + CSS vars (`var(--gia-*)`) for theming. Lucide icons, `clsx` for classes.
- No comments unless explicitly asked. Follow existing patterns; check neighbors before introducing libs.
- Never commit changes unless explicitly requested.

## Repo-specific gotchas

- `tsconfig.app.json` excludes `src/test` (tests not typechecked in build).
- `@tailwindcss/vite` is disabled when `VITEST` is set.
- Sandbox server on :3081; `files/alpine` paths referenced in some legacy code paths are not present in fresh rootfs (server refuses unsafe fallback).
- Analyst/Exam/Planner rely on strict JSON; parsing is tolerant via `extractJSON` + repair but model behavior can vary.
- ForceJSON skips tool execution (by design).
- `updateMessageInTree` does not toggle `thinking:false` on every delta (handled in `finally`).

## CI

`.github/workflows/ci.yml`: Node 22, `npm ci --legacy-peer-deps`, `npm run lint`, `npm run test:run`, `npm run build`. Android APK built via `build-apk.yml` (Java 21). GitHub Pages uses `cp landing.html index.html && npm run build`.
