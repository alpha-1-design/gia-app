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
| `ClaudeTerminalBlock` | `components/ClaudeTerminalBlock.tsx` | Claude-style dark terminal execution block UI |
| `TerminalService` | `services/TerminalService.ts` | Native shell execution & smart timeout manager (`getSmartTimeout`) |
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
| `MCPManager` | `services/MCPManager.ts` | MCP server lifecycle & OAuth deep-link handler (`gia://mcp-oauth-callback`) |
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

## Orb Assistant (floating Android orb)

Background assistant that hits any capture/voice event while the app is closed (requires **Keep-alive** in Developer settings).

- **Native:** `GIAScreenOrbService.java` (overlay, HUD, TTS, popup, MediaRecorder voice capture) + `GIAScreenAgentPlugin.java` (bridge: `orbResponse`/`setOrbSpeech`/`orbShowImage`/`performSwipe`/`openApp`/`goBack`, static emit for `orbitAnalyze`/`orbitVoice`). Signal source is `GIAAccessibilityService.captureScreen()` (writes cache-relative PNG). Voice clips go to `cache/voice/orb_capture_*.m4a` (AAC 16k), gated on `RECORD_AUDIO`.
- **JS:** `src/services/OrbAssistant.ts` listens for `orbitAnalyze` / `orbitVoice`. Screen sessions stream the PNG (vision-capable models) + a11y text through `ProviderService.callProvider` directly (bypasses GiaBrain tool loop; per-request `handsOff` is NOT honored). Voice sessions transcribe on-device via `WhisperService` (must be downloaded: Settings → Voice) then run the same brain with `voicePrompt`. `[orb_act]{...}[/orb_act]` JSON blocks drive observe→act→verify (max 4 steps) via `executeOrbAction` (`src/services/OrbControlActions.ts`); `orb_act` is also a chat tool (`src/services/tools/orbControl.ts`).
- HUD/state strings are plain text (no emoji); the Listen popup row uses the `ic_mic.xml` vector drawable.

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

## 2026-09-12 Session Summary

### Version bump → 2.4.0.3
Updated everywhere: `package.json`, `package-lock.json`, `android/app/build.gradle` (versionCode 10→11), `public/docs/gia-docs.json`, 9 User-Agent strings (`ConnectorManager`, `GatewayManager`, `FallbackWebSearch`, `powerTools`, `MCPClient`, `core`, `GIATerminalPlugin`, `GIAScreenAgentPlugin`, `GIATerminalPlugin.java`), UI strings (`SettingsModule`, `AboutPage`, `EngineRoom`), stale spots (`README.md` 2.4.0.1, `manual.md` 2.3.2.0, `GIAUpdatePlugin.java` 2.4.0).

### Changelog modal
New `src/components/ChangelogModal.tsx` + "View Changelog" button in `AboutPage.tsx`. Categorized Added/Fixed/Changed for v2.4.0.3 (talk-to-the-orb, Cloud STT fallback, runnable tools catalog, updater root fix, onboarding). Dismiss via X, "Got it", or Esc.

### Landing page redesign (`src/landing/`, lint + build green)
- **New components**: `DesktopMock.tsx` (intricate desktop window mock), `DesktopSection.tsx` (features + how-it-works), `Pairing.tsx` (phone↔desktop mesh/capability profiles), `Download.tsx` (3 real release links: AppImage/deb/rpm + self-updater flow)
- **Hero**: desktop-ready aurora hero with "Linux ships today" + Windows/iOS coming-soon badges
- **Nav + sections**: Desktop, Features, On-Device, Pairing, Download, Skills, Docs, FAQ — new order in `App.tsx`
- **CTA/Footer/landing.html** updated with desktop repo links
- **Windows & iOS "coming soon"** badges in Hero + banner in Download section

### Orb voice + Cloud STT (from prior work, now committed)
- Native: `GIAScreenOrbService.java` — MediaRecorder voice capture (AAC 16k), 5-item popup with vector mic icon (`ic_mic.xml`), HUD placeholders, 15s auto-stop
- JS: `OrbAssistant.ts` — `orbitVoice` listener, `transcribeOrbAudio` (Whisper-first → cloud fallback), `voicePrompt` in `streamTurn`
- `CloudSTT.ts` — OpenAI/Groq fallback, `gia:cloud-stt` config
- `VoiceSection.tsx` — "Orb Cloud STT" card (enable, API key, base URL, model, Groq hint)
- Emoji cleanup: HUD strings plain text, `ic_mic.xml` vector drawable in popup

### GitHub profile README rewrite + push
`alpha-1-design/alpha-1-design` → new "About the developer" section, GIA desktop release coverage, updated project links (commit `15d7f09`).

### CI/CD
- Tag `v2.4.0.3` pushed → GitHub Actions builds signed release APK + debug APK
- Release published: https://github.com/alpha-1-design/gia-app/releases/tag/v2.4.0.3
- Assets: `app-release.apk` (20.9 MB), `app-debug.apk` (24.7 MB)

## 2026-09-21 — terminal/rootfs proot audit (research only, files NOT changed)

Context: commit `0f1e074` (v2.4.0.10) fixed one two-copy divergence — the proot one-shot path in `GIATerminalPlugin` previously bypassed every fix applied to the interactive `GIATerminalService.startSession()` path. That class of bug repeats elsewhere. Verified against working tree.

**Consolidated & safe (do NOT re-split):**
- Only TWO native spawn sites, both through the shared builders: `GIATerminalService.java:700-704` (startSession) + `GIATerminalPlugin.java:735-740` (one-shot, used by Full Install/install/remove/search/list/update). Shared code: `buildProotArgs()` (`GIATerminalService.java:849`, binds `/dev /proc /sys /system /vendor /apex /data /mnt /storage`, `-0`, `-w /root`, `/bin/sh -c`) + `configureProotEnvironment()` (`:900`, env vars incl. `PROOT_LOADER`/`_32`, `LD_LIBRARY_PATH`=nativeLibraryDir, `SSL_CERT_FILE`, `PR_SET_DUMPABLE` via `prctl`). Named loader path via `resolveLoaderPath()` (`:628`).
- DNS written during native rootfs extraction (all paths): `GIATerminalService.java:346-350, 560-564`, `GIATerminalPlugin.java:563-568`. Remote server also writes resolv.conf + mkdirs `/workspace` (`server/sandbox-server.cjs:152-162, 338`).
- Non-proot Java plugins verified process-free: `GIAScreenAgentPlugin`, `GIAUpdatePlugin`, `GIADeviceInfoPlugin`, `GIAMediaPlugin`, `GIAIntentPlugin`, `CorePlugin`.

**Divergent/fragile copies — real traps:**
- `GIAProotNative.java:84` — DEAD but divergent argv (no loader env, no PR_SET_DUMPABLE). Do not port/revive it as "the simpler path"; keep. JNI `loadLibrary("proot")` always fails so it never runs.
- `src/services/CodeRunner.ts:112-137` `runInSandbox()` — BROKEN dead copy: wrong proot style (`-S`, `files/alpine` path), then misuses `Filesystem.readFile` with the command string as path. Only unreachable because `isSandboxAvailable()` (`:67-75`, stats `files/alpine/bin/sh` = never exists) is always false. Delete or rewrite against `TerminalService`.
- **Native drops `workdir`/`env`:** TS `TerminalService.exec()` (`:155-191`) passes them, but `GIATerminalPlugin.exec` (`:73-126`) reads only command/sessionId/timeout; proot hardcodes `-w /root`. Every native exec runs in `/root` (remote honors workdir → native/remote behavioral split).

**Missing DNS / package-verification — these fail silently:**
- `src/services/tools/security.ts:38`, `ssh.ts:103`, `network.ts:7` — `apk` via hardcoded `http://localhost:3081/exec` → dead on-device. `database.ts:47` — `execViaSandbox` `apk add` with no `apk update` first.
- `src/services/SandboxEnvService.ts:313-329` `repair()` — `apk update/fix` but NEVER regenerates a deleted resolv.conf (installEnvironment `:184-191` + provision `:267-275` are the correct DNS-first pattern to copy).
- Correct DNS-first pattern to replicate: `SandboxSetupPanel.tsx:208-220` (Full Install) + `SandboxEnvService` above.

**Workspace & helper-script gaps — tools that fail out-of-the-box:**
- `/workspace` created ONLY by the Full Install button (`SandboxSetupPanel.tsx:246-248`, explicit-space `mkdir -p` — busybox ash silently no-ops brace expansion). Native `writeFile` (`SandboxService.ts:125-131`) never mkdirs it; `filegen.ts` writes its input with a relative path (= `/root` on native) then reads `/workspace/<it>` → always fails on-device.
- `generate_file` pdf/pptx/docx (`filegen.ts:78-82, 121`): `gen_pdf.py`/`gen_pptx.py`/`gen_docx.py` DO NOT EXIST anywhere in the repo and are never provisioned → those formats always fail, remote AND native.
- `browse_web.py` exists in `server/` but is never uploaded to `/workspace` → `documents.ts:325` fails fresh. Only `read_doc.py` is self-provisioning (`documents.ts:467 READ_DOC_SCRIPT`).
- Bare `python3`/`node` with zero toolchain check: `filegen.ts:121`, `documents.ts:325/469`, `tools/build.ts` (a fresh rootfs yields confusing `sh: node: not found`). Safe pattern to copy: `SandboxEnvService.ts:200-207` version-check + short-circuit.

**Proposed fix order (user value):** (1) provision `gen_*.py` + `browse_web.py`; (2) native exec/writeFile honor `workdir` + `mkdir -p /workspace`; (3) delete `CodeRunner.runInSandbox`; (4) DNS guard in `repair()`.
**Do NOT fix any of this without the user's go** (standing rule: don't commit/work without instructions; UI shows the MCP-tab catalog in `SandboxSetupPanel.tsx:107-116, 654-678` is static links only — no real MCP wiring there).

## 2026-09-22 — audit fixes implemented + 3 user complaints confirmed (pending, do tomorrow)

### Fix round 1 — DONE, verified (830/830 tests, tsc, eslint on changed files, `npm run build` ✔)
All applied to the working tree (HEAD still `0f1e074`; nothing committed). Java edits are read-verified only — no Java toolchain on this box, they need the CI `gradlew` run:
1. **Provision `gen_*.py` + `browse_web.py`:** `src/services/tools/filegen.ts` — `gen_pdf.py`/`gen_pptx.py`/`gen_docx.py` (never existed in repo) now embedded as `GEN_SCRIPT_BODY` const (stdlib-only, JSON-on-stdin) and self-provisioned to `/workspace/` + input file, exec'd with absolute paths, both deleted in `finally`. `src/services/tools/documents.ts` — `BROWSE_WEB_SCRIPT` mirrors `server/browse_web.py`; `browse_web` writes it to `/workspace/browse_web.py` before exec and deletes after.
2. **Native exec/writeFile honor `workdir` + `mkdir -p /workspace`:** `GIATerminalService.java` — `startSession`/`buildProotArgs`/`configureProotEnvironment` got `(…, workdir, env)` overloads (old 3-arg forms delegate); proot `-w` now uses caller workdir (default `/root`); `extraEnv` applied FIRST so guest critical vars (HOME/PATH/proot loader) always win. `GIATerminalPlugin.java` — `exec`/`spawn` pass `workdirFrom(call)`/`envFrom(call)` (new helpers; `HashMap` import). `SandboxService.ts` — `sandboxParent()` helper; native `writeFile` runs `mkdir -p -- "<parent>"` first.
3. **Delete `CodeRunner.runInSandbox`:** `src/services/CodeRunner.ts` — dead broken `runInSandbox` + `isSandboxAvailable` removed, branch deleted, `@capacitor/filesystem` `Directory`/`Filesystem` import removed (file now 302 lines).
4. **DNS guard in repair():** `src/services/SandboxEnvService.ts` — `repair()` seeds `test -f /etc/resolv.conf || (echo nameserver 8.8.8.8 … 1.1.1.1 …)` before `apk update`.

### Fix round 2 — 3 user complaints CONFIRMED, do tomorrow (user's go given 2026-09-22)
1. **No skill creator.** CONFIRMED. GIA only has `skill_list`/`skill_activate` (`src/services/tools/skills.ts:11,28`) + `install_skill` (install of pre-built URL/package defs, `src/services/tools/build.ts:218`). `SkillsMarketplace.createCustomSkill` exists (`src/services/SkillsMarketplace.ts:1014`) but its ONLY caller is the Settings form (`src/components/settings/SkillsMarketplaceSection.tsx:105`) — no chat tool, so GIA cannot author a skill while talking. **Fix:** add `skill_create` tool (schema → `createCustomSkill`), register in `src/services/tools/index.ts` + prompt table at `src/services/buildGiaSystem.ts:170`; optional `skill_delete`/`skill_edit`.
2. **Always running in background.** CONFIRMED. `android/.../BootReceiver.java:20-29` starts `GIACoreService` unconditionally on every boot (`ACTION_BOOT_COMPLETED`) with wake word `"JARVIS"` (0.7f sensitivity). `GIACoreService.java` is a foreground service (`startForeground` :78, `START_STICKY` :90) holding an **indefinite `PARTIAL_WAKE_LOCK`** (:119) with a watchdog that re-acquires the lock if stripped (:132-148). `GIAAccessibilityService.java:234-235` also persists once OS-enabled. No preference gates the boot receiver. **Fix:** gate `BootReceiver` on a persisted prefs toggle + UI control (Settings → Developer), and stop the core/fg service when the user turns GIA off; consider deferring `startWakeLockWatchdog`/wake lock until a user action needs it.
2b. **TerminalService always active even when terminal not set up.** CONFIRMED. `GIATerminalPlugin.load()` (`GIATerminalPlugin.java:40-43`) calls `startTerminalService()` (:56-64) UNCONDITIONALLY at plugin registration — every app launch starts the foreground `GIATerminalService` (`giaterminalservice` is `START_STICKY`, `GIATerminalService.java:242`; `startForeground` :197, :235), which immediately kicks off rootfs extraction in `onStartCommand` (:214-226). No check whether the rootfs was ever set up (`GIATerminalPlugin.java:800-809` already exposes a `.gia-rootfs-ok` marker written by `extractAndVerify` :685-689 — gate on it). **Fix:** in `startTerminalService()` only start when rootfs marker exists (or after first successful setup), else defer until `terminalRun`/`sandbox_exec` first needs it.
3. **Not proactive.** CONFIRMED (opt-in, off by default). Full autonomy stack exists (`useAutonomyStore`, `useAutomationStore`, `useProtocolStore` fullAutonomy, `SchedulerService`, `ProactiveEngine.ts`) but `useAutonomyStore.ts:49` `enabled: false` default and `ProactiveEngine.ts` early-returns on that flag — nothing initiates until the user flips Settings → Autonomy. **Fix:** the user wants proactivity to work; plan = default toggle on + opt-in onboarding nudge, and verify ProactiveEngine actually fires (schedules, proactive tools, notifications).

**Standing rules:** don't commit without the user's go; do not `git add` blindly; keep `M AGENTS.md` + untracked `.github/copilot-instructions.md` as-is unless asked. Repo git identity still unset — use inline `-c user.name=alpha-1-design -c user.email=alpha-1-design@users.noreply.github.com`.

## 2026-09-23 — release hardening completed

Completed:

- Sandbox package operations now detect `apk` or `apt-get` explicitly. Unsupported package managers fail clearly instead of silently defaulting to Alpine.
- Alpine and Ubuntu provisioning use their native package managers, including Debian mappings for `py3-pip` and `build-base`.
- Package index, install, repair, and reset failures are surfaced as failures.
- Remote sandbox host fallback was removed. A missing rootfs now blocks execution instead of running commands on the host.
- Remote filesystem paths are canonicalized and constrained to the configured workspace; clone inputs are validated.
- Sandbox tests cover Alpine detection, Ubuntu package selection, unsupported-manager failure, provisioning, repair, reset, and workspace behavior.
- Daemon hardening removed Telegram token-prefix logging, preserves the last valid config during reload failures, reconciles pollers after valid reloads, and documents bridge-only Telegram behavior.
- Test validation reached 84 test files and 836 passing tests before the latest release-validation run; focused sandbox coverage is green after the test updates.

Remaining release gates:

- Android Gradle compilation must run in CI or Android Studio because this Windows environment has no Java/JAVA_HOME.
- Alpine and Ubuntu installation, package operations, file creation, permissions, Termux, and lifecycle behavior still require real Android-device validation.
- Credential/permission automatic continuation and legacy credential-store consolidation remain follow-up work.
