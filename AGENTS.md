# GIA App — Agent Guide

## Commands

Exact commands (CI runs the middle three in this order, `.github/workflows/ci.yml`, Node 22):

```bash
npm ci --legacy-peer-deps   # no .npmrc — flag is mandatory; CONTRIBUTING.md's plain `npm install` is wrong
npm run lint                # eslint .
npm run test:run            # vitest one-shot; `npm run test` is WATCH mode
npm run build               # tsc -b && vite build — this is the only typecheck, it also checks tests
npm run dev                 # sandbox server :3081 + Vite :3000
npx cap sync android        # after build, before any Android work
```

Use npm only — `package-lock.json` and CI drive installs; the tracked `bun.lock` is an unused leftover (no script references bun).

Focused checks:

- Single test: `npm run test:run -- src/path/to/file.test.ts`
- Single lint target: `npx eslint src/path/to/file.tsx`
- Typecheck without building: `npx tsc -p tsconfig.app.json --noEmit` (~20s).
- Tests **are** typechecked by `npm run build`: `tsconfig.app.json` `include: ["src"]` pulls in every `*.test.*` file under `src/`; only `src/test/` (the vitest setup file) is excluded. `server/sandbox-server.test.js` runs under vitest too but isn't typechecked (plain JS, outside `src/`). Vitest itself transpiles without typechecking, so tests pass at runtime while failing `tsc`.

## Architecture (must know)

- Single-package SPA (React 19), **no framework router**. Shell: `src/App.tsx` (module chosen via `useGiaStore.currentModule`, `Module` union in `src/store/useGiaStore.ts`).
- 9 modules registered (`src/config/appModules.tsx`): **Chat, Build, Settings load eagerly**; Writer, Planner, Analyst, Exam, Autonomy, Agents are `lazy()`. `DashboardModule` is not a module — it renders as a Settings sub-page.
- Vite 8: `base: './'` (Capacitor requires relative paths), `cssMinify: 'esbuild'` (Tailwind v4 LightningCSS conflict), path alias `@/` → `src/`. Tailwind v4 via `@tailwindcss/vite`, disabled when `VITEST` is set.
- Root `config.json` is runtime config (imported by `src/config/appConfig.ts`) — shipped defaults for app name, orb/motion defaults, local model (`onnx-community/Qwen2.5-1.5B-Instruct`). Per-device user settings always win.
- **No env vars needed for local dev.** `.env.example` (`GEMINI_API_KEY`, `APP_URL`) is an unused Google AI Studio template leftover — nothing in `src/`, `server/`, or `scripts/` reads it. (`metadata.json` is that applet's metadata.)
- **Generated / never hand-edit**: `dist/` and `android/app/src/main/assets/public/**` are gitignored and refreshed by `npm run build` / `npx cap sync android`. There is no other codegen — `package.json` has no generate script.
- Dev server: `npm run dev` runs `node server/sandbox-server.cjs & vite --port=3000 --host=0.0.0.0`; Vite proxies `/api/sandbox` → `localhost:3081`. Sandbox needs an Alpine rootfs (`scripts/setup-alpine-sandbox.sh`, gitignored) and **refuses unsafe host fallback** when missing. The `&` sandbox process is never cleaned up — repeated `npm run dev` leaves an orphan holding :3081 (no EADDRINUSE handling in `server/sandbox-server.cjs`); kill it manually. Optional env overrides (all `SANDBOX_`-prefixed): `SANDBOX_PORT`, `SANDBOX_ROOTFS`, `SANDBOX_WORKSPACE`, `SANDBOX_PROOT_BIN`, `SANDBOX_USE_DOCKER` (`server/sandbox-server.cjs`).
- Themes via `data-theme` on `<html>`: `dark`, `light`, `obsidian-aurora` (**default** — store initial state), `system`. Vars in `src/styles/globals.css`.

## Generation & streaming

Flow: `useChatState → useChatGeneration → GiaBrain.generate() → provider adapter → tool loop`

- **Centralized streaming**: provider adapters (`src/services/providers/{openai,anthropic,gemini,local}.ts`) send **raw** text deltas to `onStream`; only `src/hooks/useChatGeneration.ts` calls `sharedProcessStreamChunk` (`src/utils/streamParser.ts`). Do not process chunks inside an adapter.
- Adapters buffer partial SSE lines (`partialLine`, etc.) across XHR chunks and flush on `onload`.
- Watchdog (`src/services/providers/streamWatchdog.ts`): `FIRST_BYTE_TIMEOUT_MS` 60s, `STREAM_IDLE_TIMEOUT_MS` 30s. `finally` blocks set `thinking: false` on the message — the store does not force it per delta.
- **ForceJSON** (Analyst/Exam/Planner/KnowledgeGraph): callers pass `forceJson: true` plus their own temperature (0.25–0.45) and the JSON-only instruction in their `systemPrompt`. Adapters then set `response_format: json_object` (OpenAI) / `stop_sequences` (Anthropic) and **skip native tool schemas**. `generateWithRetry<T>()` (`src/utils/generateWithRetry.ts`) adds 4 retries (800ms→3s delays, waits out offline), repairs via `OutputValidator`, extracts with `extractJSON<T>`. Note: parsing is tolerant but model output still varies; ForceJSON skips tool execution by design.

## Tool system

- Tools are primarily a **text protocol, not native function calling**: the system prompt (`src/services/buildGiaSystem.ts`) tells the model to emit fenced code blocks tagged `tool` containing `{ "id", "args" }`, which `streamParser`/`ToolExecutionService` parse and run.
- Native provider tool schemas are sent **only when Hands-Off mode is ON** (`handsOff` in `useGiaStore`) and not ForceJSON — see the `enableTools` guards in each adapter.
- Non-Hands-Off runs route tool calls through user approval (`useProtocolStore`).
- Registration: `registerAllTools()` in `src/services/tools/index.ts` (53 tool lists, ~70 files). Execution: `src/services/brain/toolRunner.ts` (120s timeout) + `ToolExecutionService`/`ToolRegistry`. `GiaBrain` caps the loop at 10 iterations and treats `malformed_json` / `truncated_tool_call` / `__CLARIFICATION__` as loop results.
- `GiaBrain` is a singleton (`src/services/GiaBrain.ts`).

## Providers & failover

- `src/services/ProviderRegistry.ts`: 22 providers, default active provider `opencode` (OpenCode Zen) with default model `deepseek-v4.1-flash`.
- `src/services/brain/ResilientRelay.ts`: `pickFallback()` only cycles **same-provider models** (never cross-provider); cross-provider moves come from `pickFallbackProvider()` in `ErrorHandlingService`/`subAgent`, plus backoff capped at 45s. Health ranking via `ProviderMonitor`.
- `capacitor.config.ts` sets `CapacitorHttp.enabled = false` — **critical**: the native bridge buffers whole responses and breaks incremental streaming.

## Key services

| Service | Path | Purpose |
|---|---|---|
| GiaBrain | `services/GiaBrain.ts` | Orchestrator + tool loop |
| buildGiaSystem | `services/buildGiaSystem.ts` | System prompt assembly (tool table lives here) |
| generateWithRetry | `utils/generateWithRetry.ts` | Retry + repair + `extractJSON` for ForceJSON flows |
| streamParser | `utils/streamParser.ts` | `processStreamChunk`/`stripToolBlocks`/think-block flushing |
| OutputValidator | `services/OutputValidator.ts` | Repair malformed JSON/fences |
| ProviderRegistry/Monitor | `services/ProviderRegistry.ts`, `ProviderMonitor.ts` | Model catalogs + health |
| ResilientRelay | `services/brain/ResilientRelay.ts` | Failover/backoff decisions |
| RAGService/LocalLLM | `services/RAGService.ts`, `LocalLLMService.ts` | Local embeddings/LLMs (Transformers WASM) |
| MCPManager | `services/MCPManager.ts` | MCP lifecycle (OAuth redirect `gia://mcp-oauth-callback`) |
| TerminalService | `services/TerminalService.ts` | Native shell + smart timeouts |
| OrbAssistant/OrbControl | `services/OrbAssistant.ts`, `services/tools/orbControl.ts` | Floating Android orb actions |

## State

Zustand 5 under `src/store/` (27 files). Persistence: `src/store/idb-storage.ts` → IndexedDB, 300ms debounce (last write wins during streaming), flushed on `beforeunload`/`pagehide`/`visibilitychange`/`freeze`/Capacitor `appStateChange`. Use `useShallow` for object selectors. Core stores: `useGiaStore`, `useProviderStore`, `useMemoryStore`, `useAgentStore`, `useAutonomyStore`, `useProtocolStore`, `useMCPStore`, `useTaskStore`, `useNotesStore`, `usePluginStore`, `useFileStore`.

## Tests

Vitest 4, `globals: true`, `jsdom`, `setupFiles: ./src/test/setup.ts` (mocks IndexedDB/AudioContext — extend there, not per test). ~140 test files under `src/`, plus `server/sandbox-server.test.js`, colocated in `__tests__/` dirs or beside sources. Import assertions from `vitest`; use `vi.spyOn` / `vi.useFakeTimers()`. `pool: 'threads'`, `css: false`. A few tests bind local ports or spawn servers (`unimindE2E`, `useMCPStore`, `SandboxService`, `sandbox-server.test.js`) — can collide under parallel runs.

## Android / Capacitor

- After `npm run build`: `npx cap sync android && npx cap open android`. `android/` is committed; `cap sync` only refreshes web assets and plugin config.
- APK CI (`build-apk.yml`): `npm ci --legacy-peer-deps` → `npm run build` → Java 21 (Temurin) → `npx cap sync android` → gradle-wrapper regen → keystore restore → `./gradlew assembleDebug` + `assembleRelease`. Release signing uses the persistent `RELEASE_KEYSTORE_BASE64` repo secret — without it CI signs with a throwaway keystore and the APK can't update an existing install.
- Tracked binaries — never hand-edit or "clean up": `android/app/src/main/assets/{terminal/alpine-minirootfs.tar.gz, terminal/proot, wakeword/*.onnx}`, `android/app/src/main/jniLibs/arm64-v8a/libproot.so`, `server/proot`. The Hey Jarvis wakeword models are **CC BY-NC-SA** (`DEVLOG.md` 2026-10-06, `docs/wake-word.md`) — replace with a custom model before monetizing.
- `setup-android.sh` (Termux) does install → build → `cap add`/`cap sync` → inline Python patches for `AndroidManifest.xml` permissions. `android-manifest-patch/` and `android-res-patch/` are unreferenced reference copies — no script reads them.
- `daemon/` is a separate sub-project (`gia-gateway-daemon`, Telegram/Discord gateway) with its own `node --test` suite — root `npm run test` does not cover it (eslint does lint it).

## Conventions

- Functional components + hooks only. TypeScript strict; Zod for tool inputs; avoid `any`.
- Tailwind v4 utilities + CSS vars (`var(--gia-*)`/`--mod-*`) for theming; Lucide icons; `clsx` for conditional classes.
- No comments unless explicitly asked. Follow existing patterns; check neighbors before adding a dependency. (`CONTRIBUTING.md` says to document `GiaBrain.ts` and claims Prettier is used — neither matches reality; ignore both.)
- Local-first rule: no new deps/flows that require a central cloud backend, no telemetry (CONTRIBUTING.md).
- `public/docs/gia-docs.json` is hand-maintained and shipped to the GitHub Pages URL the system prompt tells the model to fetch (`src/services/buildGiaSystem.ts`); the landing docs view reads it too — update it when user-facing features change.
- Never commit changes unless explicitly requested.

## Docs & trackers worth knowing

- `docs/features/development.md` — architecture map + Android sync notes; `manual.md` — user-facing feature manual.
- `DEVLOG.md` — chronological change log; recent work appends a dated entry.
- `ISSUES.md` — running manual issue tracker (not synced with GitHub Issues); `issues.md` (lowercase) is a separate QA report.
- `.github/copilot-instructions.md` — overlapping agent instructions; this file supersedes where they conflict (its eager/lazy module list is stale).

## CI

`.github/workflows/ci.yml`: Node 22, `npm ci --legacy-peer-deps` → `lint` → `test:run` → `build`. `deploy-pages.yml` runs `cp landing.html index.html && npm run build` (Pages overwrites `index.html` from `landing.html` — don't treat the committed `index.html` as the landing deploy source). `build-apk.yml` builds the Android APK on main/staging/tags.
