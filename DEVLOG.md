# GIA Development Log

Chronological record of changes, rationale, and decisions.

---

## 2026-07-20

### Removed: all desktop-only code (mobile-only app)

GIA is a mobile-only Capacitor app; a separate desktop app is planned. Everything that
depended on the Chromium-only `window.showDirectoryPicker` File System Access API has been
deleted from the mobile codebase (not just hidden), because it was dead on the phone and
cluttering the UI.

**Deleted files**
- `src/services/DesktopFS.ts` — `showDirectoryPicker` wrapper (project-folder handle).
- `src/components/FileBrowser.tsx` — desktop project-folder browser sheet.
- `src/components/CommandPalette.tsx` — desktop ⌘K command palette (only openable via keyboard).
- `src/hooks/useKeyboardShortcuts.ts` — keyboard-only shortcut registration (irrelevant on mobile).

**Removed from registered tools / schemas**
- `filesystem_desktop_read` / `filesystem_desktop_write` / `filesystem_desktop_list` tools
  (`src/services/tools/filesystem.ts`), their schemas (`src/services/brain/toolSchemas.ts`),
  the `| Desktop Chrome only |` rows in the system prompt (`src/services/buildGiaSystem.ts`),
  and the `desktopFilesystemAccess` capability flag (`src/services/tools/core.ts`).
- `toolRunner.ts` fallback hints + `PARALLEL_SAFE_TOOLS` no longer reference desktop tools.

**Removed UI**
- ChatModule header "Browse files" folder button + `showFileBrowser` state (`useChatState.ts`).
- AgentsModule `Desktop Read`/`Desktop Write` tool toggles + descriptions.
- CommandPalette `pick-folder` command; `toolIcons.ts` / `ToolIcons.tsx` desktop entries.

**Docs:** README, manual updated to drop desktop project-folder feature.

---

## 2026-07-20

### Premium push — Tier 1: Artifacts + Regenerate/Edit (discoverability + Canvas)

Audited GIA against ChatGPT/Claude/Perplexity/Gemini 2026 UX. Found that **Artifacts,
Regenerate, and Edit already existed** but were hidden behind the long-press context menu
(`MessageContextMenu`), so they felt absent. The premium gap was discoverability + a true
Canvas view, not missing logic.

**Changes**
- `src/components/MessageList.tsx` — added a visible `MessageActions` toolbar under every
  message (ChatGPT-style): assistant → **Copy + Regenerate**; user → **Copy + Edit**. Error
  messages keep their own Retry/Edit buttons. Makes the existing regenerate/edit power
  features discoverable instead of buried in a long-press menu.
- `src/components/ArtifactsPanel.tsx` — added an **Open in Canvas** button that opens the
  active artifact in a full-screen Canvas overlay (HTML live `iframe` preview, SVG, Mermaid,
  code via `ArtifactRenderer`). The Claude-Artifacts-style side canvas, adapted for mobile.

**Already present (verified, not changed)**: `streamParser.ts` extracts ` ```artifact ` blocks;
`useChatGeneration` stores them via `updateMessageArtifacts`; `buildGiaSystem.ts` already
instructs the model to emit artifacts; `handleRetry` regenerates any assistant message;
`handleEditResend` loads a user message back into the composer for edit-and-resend.

---

## 2026-06-05

### Fixed: SettingsModule naming conflict
**File:** `src/modules/SettingsModule.tsx:30-35`

**Problem:** Two `setName` declarations collided:
- Line 30: `const { setName } = useGiaIdentity()` (Zustand store setter for GIA identity)
- Line 35: `const [name, setName] = useState(userProfile.name)` (local state for user profile)

**Fix:** Renamed local setter to `setProfileName`

**Why:** TypeScript/ESLint error prevented dev server from starting. Simple rename preserves both functionalities.

---

### Enhanced: JSON parsing resilience (`extractJSON`)
**File:** `src/utils/helpers.ts`

**Problem:** Analyst, Planner, Exam modules sometimes received invalid/truncated JSON from AI providers, causing parse failures.

**Fix:** Added Strategy 6 — `repairTruncatedJSON()` that:
- Counts unclosed braces/brackets and adds missing closers
- Fixes trailing commas before `}`/`]`
- Quotes unquoted keys
- Handles unclosed strings at end

**Why:** LLMs frequently output truncated JSON when hitting token limits. Previous 5 strategies couldn't repair structural truncation. Now auto-recovers most cases.

---

### Added: Module-level JSON retry logic
**Files:** 
- `src/modules/AnalystModule.tsx`
- `src/modules/PlannerModule.tsx`
- `src/modules/ExamModule.tsx`

**Problem:** Even with better parsing, some responses are fundamentally malformed and need a fresh generation attempt.

**Fix:** Created `generateWithJsonRetry(fn, maxRetries=2)` helper in each module that:
- Catches parse errors
- Waits 500ms/1000ms between retries
- Re-invokes `GiaBrain.generate()` for fresh response
- Logs attempt number for debugging

**Why:** Defense in depth. Parsing fixes handle truncation; retry handles completely garbled output. 2 retries balances UX (speed) vs reliability.

---

### Implemented: Auto-continuation for truncated responses
**Files:**
- `src/services/providers/types.ts` — added `finishReason`, `wasTruncated` to `BrainResponse`
- `src/services/providers/openai.ts` — capture `finish_reason === 'length'`
- `src/services/providers/anthropic.ts` — capture `stop_reason === 'max_tokens'`
- `src/services/providers/gemini.ts` — capture `finishReason === 'MAX_TOKENS'`
- `src/services/GiaBrain.ts` — auto-continue logic in agentic loop

**Problem:** Long responses hit token limits and cut off mid-sentence. User had to manually click "Continue".

**Fix:** When `wasTruncated=true` AND no tools executed AND iterations < max:
1. Emit thought: `⚠️ Response truncated — continuing...`
2. Push partial response to history
3. Loop with prompt: `"Continue from where you left off. Do not repeat. Just continue naturally."`
4. Stream continuation seamlessly to UI

**Why:** Transparent to user. Preserves context via history. Works across all providers. Max 10 iterations prevents infinite loops.

---

### Redesigned: Clarification panel → Bottom Sheet
**Files:**
- `src/components/chat/ClarificationBottomSheet.tsx` (new)
- `src/modules/ChatModule.tsx` — replaced inline panel

**Problem:** Inline clarification panel felt cramped, didn't focus input, poor mobile UX.

**Fix:** Modal bottom sheet with:
- Spring animation (`damping: 25, stiffness: 300`)
- Backdrop overlay (tap to dismiss)
- Auto-focused input
- Accessible: `role="dialog"`, `aria-modal`, `aria-labelledby`
- Quick option buttons + custom text
- Auto-dismisses on send

**Why:** Mobile-first pattern. Standard iOS/Android behavior. Better focus management. Cleaner chat UI when not needed.

---

### Fixed: Header overflow on narrow devices
**Files:**
- `src/modules/ChatModule.tsx:125-156` — header layout
- `src/components/chat/ProviderStatus.tsx` — responsive pill

**Problem:** Long provider names (e.g., "OpenRouter") pushed action buttons (Folder, Brain, Download, Trash, Plus) off-screen on mobile.

**Fix:**
- Action buttons: `shrink-0` (never shrink)
- Provider pill: `flex-1 min-w-0 max-w-[180px]` (shrinks/truncates first)
- Model name: `hidden sm:inline` (hidden on mobile)
- Chat title: `truncate` with `flex-1 min-w-0`
- Right section: `justify-end` (buttons anchored right)

**Why:** Flexbox `min-w-0` allows truncation. `shrink-0` protects critical actions. Mobile-first responsive hiding.

---

### Added: Local Model Support (Ollama & LM Studio)
**Files:**
- `src/services/ProviderRegistry.ts` — added `lmstudio` provider, configurable base URLs
- `src/store/useProviderStore.ts` — added `baseUrl` to `ProviderConfig`, LM Studio model fetching, `setProviderBaseUrl` action
- `src/components/EngineRoom.tsx` — `url <alias> <url>` command for custom endpoints

**Problem:** Local providers had hardcoded localhost URLs. Users couldn't change ports or use remote instances (e.g., Ollama on another machine, LM Studio on LAN).

**Fix:**
1. Added `lmstudio` provider definition with OpenAI-compatible listing
2. Made `baseUrl` configurable per-provider in store (persisted to IndexedDB)
3. LM Studio fetches models via `/v1/models` endpoint (like OpenAI)
4. Engine Room `url` command: `url ollama http://192.168.1.50:11434/v1`
5. Local providers use direct `fetch` (no CORS proxy) for speed

**Why:** 
- No hardcoded IPs — users control endpoints
- Persisted config survives reloads
- Consistent UX: same `connect`/`model`/`use` commands work for local providers
- LM Studio auto-detects loaded model via `/v1/models`

---

---

## 2026-06-12

### Added: GitHub Actions CI Pipeline
**Files:**
- `.github/workflows/ci.yml` (new)

**Status:** Configured two CI jobs:
- **gia-app** — runs `npm ci`, `lint`, `vitest run`, and `build` on Node 22
- **gia-core** — runs `cargo check` and `cargo test` via dtolnay/rust-toolchain

### Test Results — 225 passing, 0 failing
**Test suite health:** All 17 test files pass (225 tests total):

| Area | Tests | Status |
|------|-------|--------|
| `src/hooks/__tests__/useVoiceInput.test.ts` | — | ✅ |
| `src/hooks/__tests__/useFileAttachments.test.ts` | — | ✅ |
| `src/store/__tests__/useProtocolStore.test.ts` | — | ✅ |
| `src/store/__tests__/useMemoryStore.test.ts` | — | ✅ |
| `src/services/__tests__/ProviderMonitor.test.ts` | — | ✅ |
| `src/services/__tests__/GiaTools.test.ts` | — | ✅ |
| `src/services/__tests__/OutputValidator.test.ts` | — | ✅ |
| `src/services/__tests__/ResponseCache.test.ts` | — | ✅ |
| `src/services/__tests__/PlatformServices.test.ts` | — | ✅ |
| `src/services/__tests__/ToolboxService.test.ts` | — | ✅ |
| `src/services/__tests__/buildGiaSystem.test.ts` | — | ✅ |
| `src/services/__tests__/InputGuardrails.test.ts` | — | ✅ |
| `src/utils/__tests__/streamParser.test.ts` | — | ✅ |
| `src/utils/__tests__/logger.test.ts` | — | ✅ |
| `src/utils/__tests__/id.test.ts` | — | ✅ |
| `src/utils/__tests__/helpers.test.ts` | — | ✅ |
| `src/components/__tests__/ThinkingStatus.test.tsx` | — | ✅ |

**Duration:** 21.5s (transform 1.5s, setup 0.9s, import 2.5s, tests 1.3s, environment 13.8s)

### Added: README documentation for 5 undocumented feature areas
**Files:** `README.md` (+85 lines)

**New sections documented:**
- **Social Media Manager** — 7 platforms, OAuth, post lifecycle, analytics (9 tools)
- **API Gateway** — route management, proxying, logging, stats (8 tools)
- **Connector System** — 11 pre-configured API connectors with key management (6 tools)
- **Telegram Channel Integration** — bot setup, text/photo posting, stats (7 tools)
- **JSON Retry System** — exponential backoff for LLM JSON failures
- **Provider Health Monitoring** — per-model latency/success rate/degradation detection

Previously these features existed only in source code with no README documentation.

## Next Up (Priority Order)

1. ✅ **Conversation Branching** — Session tree structure + UI (implemented: `forkSession`, `addBranch`, `switchBranch`, `BranchView` component, GitBranch button)
2. ✅ **Auto-Summarization** — Context window management (implemented: `autoSummarizeIfNeeded` in `contextManager.ts`, integrated in `useChatGeneration.ts`)
3. ✅ **Parallel Tool Execution** — Agentic loop speedup (implemented: `PARALLEL_SAFE_TOOLS` + `Promise.all` in `toolRunner.ts`)
4. ✅ **Plugin System** — Extensibility foundation (implemented: `PluginManager`, `PluginAPI`, hooks, store, UI, **PluginInstallSection** for manifest URL/file install)

---

### 2026-06-06

### Added: Plugin Installation UI
**File:** `src/components/settings/PluginInstallSection.tsx` (new), `src/modules/SettingsModule.tsx`

**Problem:** Plugin system existed but no way to install plugins from manifest URLs or files.

**Fix:** Created `PluginInstallSection` component with:
- Manifest URL input (fetch + register)
- File upload for manifest.json
- Validation of required fields (id, name, version, description)
- Optional hooks/setup loading from companion .js file
- Success/error feedback with notifications

**Why:** Completes the plugin system extensibility loop. Users can now share/install plugins via GitHub raw URLs, Gists, or local files.

---

## 2026-06-12 → 2026-06-13 (batch 1)

### Added: Local LLM, dev settings, wake-word + provider expansion
**Files:** `src/services/LocalLLMService.ts`, `src/components/settings/*`, `src/store/useProviderStore.ts`, `src/services/ProviderRegistry.ts`

**Problem:** No on-device inference path; dev toggles and wake-word were unstable; `ProviderDef` lacked a `local` listing type.

**Fix:** Local Qwen2.5 (0.5B–3B) via Transformers WASM; dev settings panel; wake-word fixes; terminal tool + settings UI; added `local` listing type; NVIDIA provider scaffolding.

**Why:** Gives GIA an offline-capable brain and tunable internals without external API keys.

### Added: Social auth, stream parser, Mermaid, device tools, storage (upgrade batch 2)
**Files:** `src/services/*`, `src/utils/streamParser.ts`, `src/modules/*`, Android `MainActivity`/services

**Fix:** Proactive engine, social-platform OAuth, local/offline mode, device-info tools, Mermaid diagram rendering, network-aware storage retries, fallback data on failure.

**Why:** Broadens GIA beyond chat into a proactive, multi-surface assistant.

### Added: Autonomy engine, module resilience, CI keystore
**Files:** `src/store/useAutonomyStore.ts`, `src/services/SchedulerService.ts`, `.github/workflows/*`

**Fix:** Autonomous background goals/progress; resilient module mounts; network-aware retries; signed-release APK keystore generated in CI.

**Why:** Enables "set it and forget it" agent behavior and reproducible Android releases.

---

## 2026-06-21 (restore + voice + autonomy)

### Restore: Reset to v2.3.1.2 with NVIDIA provider, sandbox, browse_web, document reader
**Files:** `server/`, `src/services/*`, `src/utils/generateWithRetry.ts`

**Why:** Consolidated a known-good feature baseline (sandbox doc parser, web browse, vision patterns) before further expansion. All 389 tests passing.

### Added: On-device Whisper STT (replaces VoiceOverlay)
**Files:** `src/hooks/useVoiceInput.ts` (new), `src/components/settings/VoiceSection.tsx`; **deleted** `src/components/VoiceOverlay.tsx`

**Problem:** `VoiceOverlay` was a heavy, brittle overlay component.

**Fix:** Replaced with on-device Whisper (tiny.en) STT + TTS queue / conversation-mode prep; fixed `LocalLLMService` bug.

**Why:** Local speech-to-text removes a network dependency. The deleted `VoiceOverlay.tsx` was **superseded, not lost** — its role moved into `useVoiceInput`/Whisper.

### Added: Autonomous background mode, Telegram via SW, protocol approvals, persistent notification
**Files:** `src/services/MessagingBridge.ts`, `src/store/useProtocolStore.ts`, Android services

**Why:** GIA can act in the background and request human approval for sensitive tools; persistent notification keeps it alive.

### Added: ExamModule reference tab, adaptive questions, persistent assessments
**Files:** `src/modules/ExamModule.tsx`

### Docs/CI: GitHub Pages deploy, camera dep, README updates
**Files:** `.github/workflows/pages.yml`, `README.md` (+NVIDIA/sandbox/camera/document-reader), deleted `TODO-comprehensive.md`

---

## 2026-06-22 → 2026-27 (stability + services)

### Fixed: Crash bugs, streaming retry gap, XSS sanitization, UX polish
**Files:** `src/hooks/useChatGeneration.ts`, `src/utils/streamParser.ts`, `src/components/*`

### Fixed: Agents crash, RAG fallback, QuickStarts UX
**Files:** `src/store/useAgentStore.ts`, `src/services/RAGService.ts`, `src/components/chat/QuickStarts.tsx` (later inlined — see 2026-07-11)

### Added: Persistent file store, 3D rendering, network tools, graph viz, security tools suite
**Files:** `src/store/useFileStore.ts`, `src/components/Neura*`, `src/services/tools/network*`, `src/services/tools/security*`

**Fix:** Persistent in-session file store; network subnet scan + auto-probe; graph visualizations; security tools (scan, firewall, intel, trace, quarantine).

### Fixed: Streaming freeze + thinking state stuck + orb beautification
**Files:** `src/hooks/useChatGeneration.ts`, `src/components/ThinkingStatus.tsx`

### Added: Marketing landing page, PDF/media/smart-home services, system diagnostics, widget
**Files:** `src/landing/`, `src/services/*` (PDF/media/smart-home), Android widget

**Note:** Landing page was later removed from the app entry (`ca6c5d68`) and rebuilt separately on 2026-07-02; marketing, not the app.

### Fixed: Android media session, FAT hardening (WakeWord crash, WASM threading, 16KB alignment, Proot W^X, SMS receiver)
**Files:** Android `GIAMediaService`, `src/services/*`, `ErrorBoundary`

---

## 2026-06-29 → 2026-07-03 (hardening)

### Fixed: ErrorBoundary on-screen error + copy; chat crash (useShallow selector); lazy-load modules; device RAM model recommendation
**Files:** `src/components/ErrorBoundary.tsx`, `src/App.tsx`, `src/hooks/useGiaStore.ts`

### Fixed: Bug-hunt items + widget quick actions; landing page rebuild with mock UI
**Files:** `src/components/widget/*`, `src/landing/*`

### Fixed: Hardening, parsing, context menu, screen-capture removal
**Files:** `src/utils/streamParser.ts`, `src/components/chat/*`

### Release: version bumped to 2.3.2.0 (all files), What's New updated

---

## 2026-07-06 → 2026-07-09 (Nexus multi-agent + Neura)

### Added: Neura 3D knowledge sphere + Nexus agent command + God Mode sub-agents
**Files:** `src/components/Neura3D*`, `src/store/useNexusStore.ts`, `src/services/GiaBrain.ts`

**Why:** Visual knowledge graph + spawned sub-agents give GIA a multi-agent "Nexus" runtime.

### Added: Mical security UI + Neura sphere overhaul + onThought pipeline
**Files:** `src/components/Mical*`, `src/components/Neura*`

### Added: Neura persistent knowledge graph + MCP bridge
**Files:** `src/services/RAGService.ts`, `src/services/MCPManager.ts`

### Added: Real local terminal execution (Pyodide WASM + browser JS)
**Files:** `src/services/LocalTerminal*`, `src/components/chat/Terminal*`

### Fixed: Light-mode visibility — hardcoded colors → CSS variables
**Files:** many `src/components/**` (CSS var migration)

### Added: Accurate local-model device compatibility detector
**Files:** `src/services/LocalLLMService.ts`, `src/utils/device.ts`

### Added: Agent mentions, artifacts panel, task UI, haptics, chat hooks
**Files:** `src/utils/mentionableAgents.ts`, `src/components/ArtifactsPanel.tsx`, `src/store/useTaskStore.ts`

### Fixed: Stop fabricating fake success states (Wake Word test, Social posting/analytics, Template relevance)
**Why:** Honesty/integrity — UI now reflects real outcomes, not simulated ones.

### Fixed: Merge duplicated Thinking UI; stream artifacts live; per-@mentioned-agent task; real persona selection for sub_agent_call
**Files:** `src/components/ThinkingStatus.tsx`, `src/hooks/useChatGeneration.ts`, `src/services/buildGiaSystem.ts`

### Added: Automatic checkpoint + provider failover (rate limits never lose work)
**Files:** `src/services/GiaBrain.ts`, `src/services/ProviderMonitor.ts`

### Added: Agent Swarm Dashboard — live view of Nexus multi-agent runs
**Files:** `src/components/AgentSwarmDashboard.tsx` (new)

---

## 2026-07-10 → 2026-07-11 (streaming + UX fixes)

### Fixed: Microphone infinite-restart loop + lost composer drafts
**Files:** `src/hooks/useVoiceInput.ts`

### Fixed: Nexus agent runs bleeding into unrelated chat sessions
**Files:** `src/store/useNexusStore.ts`, `src/hooks/useChatGeneration.ts`

### Fixed: Markdown emphasis in table cells; long pasted text auto-send → attach as .txt
**Files:** `src/utils/streamParser.ts`, `src/modules/ChatModule.tsx`

### Fixed: Responses not streaming — CapacitorHttp silently killing it; 'Proposed' tool cards not appearing; terminal native-plugin false negative
**Files:** `src/services/providers/*`, `src/components/chat/*`, `src/services/GIATerminalService*`

### Fixed: Telegram battery drain + missed backgrounded messages; @mention empty unless custom agent made
**Files:** `src/services/MessagingBridge.ts`, `src/utils/mentionableAgents.ts`

### Fixed: Rate-limit fallback always jumped providers even with one connected; sandbox tools fall back to on-device terminal
**Files:** `src/services/ProviderMonitor.ts`, `src/services/tools/*`

### Added: Obsidian Aurora theme (OLED true-black + aurora gradient)
**Files:** `src/styles/globals.css`

### Fixed: Smart Template Selector — empty on fresh accounts, broken layout, fake stats
**Files:** `src/components/SmartTemplateSelector.tsx`

### Fixed/Enhanced: Quick-start + agent-swarm cards redesigned to stack vertically
**Files:** `src/components/chat/QuickStarts.tsx` → **deleted & inlined** into `src/modules/ChatModule.tsx` (`QUICK_STARTS` array, lines ~33/292/312)

**Why:** Consolidated the home quick-start cards into `ChatModule`. The deleted `QuickStarts.tsx` was **inlined, not lost** — same feature, fewer files.

### Added: GIA's own brand mark replaces generic Bot icon in chat
**Files:** `src/components/chat/*`

---

## 2026-07-15 → 2026-07-19 (collaborative gen + stability)

### Added: Multi-provider collaborative generation, skills marketplace, live file editing + PDF/browser tools
**Files:** `src/services/GiaBrain.ts`, `src/modules/*`, `src/components/SkillsMarketplace.tsx`

### Added: On-device headline, calm UX, stability + memory quality
**Files:** `src/store/useMemoryStore.ts`, `src/components/*`

### Fixed (security): Force adm-zip 0.6.0 via overrides (CVE-2026-39244)
**Files:** `package.json` (`overrides`)

### Fixed: Prevent whole-app crash on invalid module + proper AbortError in generation
**Files:** `src/App.tsx`, `src/hooks/useChatGeneration.ts`

### Fixed: Execute tool calls whose arguments embed fenced code + revive server-error retry
**Files:** `src/services/brain/toolRunner.ts`, `src/services/providers/*`

### Fixed (storage): Surface IndexedDB write failures instead of swallowing them
**Files:** `src/store/idb-storage.ts`

### Fixed (stream): Remove per-token MessageChannel leak in streamThrottle
**Files:** `src/utils/streamThrottle.ts`

### Fixed (store): Hibernate archives full sessions instead of destroying history
**Files:** `src/store/useGiaStore.ts`, `src/store/idb-storage.ts`

---

## 2026-07-19 (uncommitted — multi-agent fan-out lifecycle fix)

### Fixed (uncommitted): Stop aborts ALL spawned generations in multi-agent fan-out
**File:** `src/hooks/useChatGeneration.ts`

**Problem:** `handleSend` can spawn several agents in parallel, but only the *last* `AbortController` (`generationKeyRef`) was tracked. Pressing Stop aborted just the last one; the rest leaked.

**Fix:** Added `allGenKeysRef` (`Set<string>`) that registers **every** controller per `handleSend`, aborts/cancels all of them on Stop, and cleans them up in `finally` + when all streams finish. Prevents orphaned generations and controller leaks.

**Why:** Honors the agent-swarm contract — Stop must halt the whole Nexus run, not a single branch.

**Status:** ⚠️ Not yet committed. No test added for the new cleanup path.

---

## Feature-Loss Audit (per "expand, don't lose" rule)

Between 2026-06-12 and 2026-07-19 only **2 source files** were deleted:
- `src/components/VoiceOverlay.tsx` → superseded by on-device Whisper STT (`useVoiceInput.ts`).
- `src/components/chat/QuickStarts.tsx` → inlined into `ChatModule.tsx` (`QUICK_STARTS`).

No feature was removed; both were refactors/replacements. All other ~419 changed files are additions, fixes, or migrations.
---

## 2026-07-20 (takeover — stability + UX-flow hardening)

Took over the open mandate: make GIA more stable and audit/improve real app flows without losing features. Baseline before work: `tsc -b` clean, 1 failing test (`hibernateSessions`), 1 lint warning.

### Fixed: Stale `hibernateSessions` test + completed multi-agent Stop fix
**Files:** `src/store/__tests__/useGiaStore.test.ts`, `src/hooks/useChatGeneration.ts`

**Problem:** The 2026-07-19 hibernate change archives *full* sessions into `archivedSessions` (history preserved), but the test still asserted the old "Archived…" stub-message behavior — so it failed. Separately, the in-flight multi-agent fix had registered every fan-out controller in `allGenKeysRef` but `handleStop` still only aborted `generationKeyRef.current` (the *last* agent), so pressing Stop on a Nexus run left the other agents streaming.

**Fix:**
- Test now asserts the correct contract: active + 5 live sessions, 2 archived, each archived session keeps its full message tree (`countNodes === 2`).
- `handleStop` now loops `allGenKeysRef`, aborting **every** spawned generation (plus the legacy `generationKeyRef`), then clears the set. Stop halts the whole Nexus run.

**Why:** A Stop button that doesn't stop is a correctness + trust bug in the flagship multi-agent feature.

### Fixed: Lint warning (missing `useCallback` dep)
**File:** `src/hooks/useChatGeneration.ts:523`
Added `unregisterGenerationController` to the `handleSend` dependency array.

### Added: One-tap Retry on failed responses
**File:** `src/components/MessageList.tsx`

**Problem:** A failed generation only offered "Edit & Resend" — no quick retry of the same prompt. Most failures (rate limit, transient 5xx) just need a retry.

**Fix:** Error bubbles now show **Retry** (calls `handleRetry`, which regenerates from the original user prompt) alongside **Edit & Resend**.

**Why:** Faster recovery loop for the most common failure mode; less friction when the network/provider hiccups.

### Added: Test for generation-controller abort contract
**File:** `src/store/__tests__/useGiaStore.test.ts`
Registers 3 controllers and asserts each is aborted individually — the primitive `handleStop` relies on for multi-agent Stop.

**Status:** `tsc -b` clean, `eslint .` clean, `hibernateSessions` + controller tests green. Remaining work: full `vitest run` not yet re-executed end-to-end this session (ran 1 failing test + new test only).

### Added: In-chat Model & Provider switcher (no more trips to Engine Room)
**Files:** `src/components/chat/ModelSwitcherSheet.tsx` (new), `src/components/ProviderIcon.tsx` (new), `src/modules/ChatModule.tsx`

**Problem (user-reported):** To change the current model you had to leave Chat → open Engine Room → run models → come back. Core model/provider switching was buried in an advanced panel.

**Fix:**
- New `ModelSwitcherSheet` bottom sheet, opened by tapping the provider pill in the Chat header. Lists every provider (connected status dot), and on selecting one shows its live model list (fetched on demand). Tap a model to switch instantly — no navigation away from the conversation.
- Unconnected providers can be connected inline by pasting an API key right there; an "Engine" button still opens the full Engine Room for advanced options (base URL, etc.).
- Real **brand logos** via `react-icons` Simple Icons for providers that ship them (Anthropic, Gemini/Google, HuggingFace, Ollama, NVIDIA, OpenRouter, DeepSeek, Mistral, Perplexity, etc.), plus the **official brand SVGs** embedded for providers Simple Icons dropped over trademark (OpenAI, xAI/Grok, Groq, Cohere, Together, Cerebras) — so each provider shows its actual logo, not a look-alike.
- `ProviderIcon` is reusable (brand-tinted chip, or `bare` for inline use in the header pill).

**Why:** Model/provider switching is a top-3 daily action in an AI assistant; it must be one tap from the chat surface, not hidden behind an advanced panel.

**Dependency added:** `react-icons` (exact Simple Icons brand set).

### Added: Model switcher reachable from Command Palette + shortcut
**Files:** `src/components/CommandPalette.tsx`, `src/App.tsx`, `src/store/useGiaStore.ts`

**Fix:** Lifted the switcher open-state into the store (`showModelSwitcher`/`setShowModelSwitcher`) so it can be triggered from anywhere. Added a "Switch Model & Provider" command to the ⌘K palette and a `⌘/Ctrl+Shift+M` shortcut. The chat header pill tap still opens it.

**Why:** Model switching is a frequent action; it should be reachable by palette and keyboard, not only by tapping the header.

---

## 2026-07-20 — Mobile-first UX flows + live voice transcription

### Context
User clarified the app is a **full mobile app (Capacitor), not desktop** — so interactions must be touch-first (large tap targets, no reliance on keyboard shortcuts) and core mobile flows (connect, stop, voice dictation) must feel native. The earlier model-switching and bug fixes were correct but the *visible* UX still had desktop-ish friction, and the mic did not show word-for-word live text.

### Fixed: First-run & "no provider" CTAs now open the in-chat switcher (no trip to Settings)
**Files:** `src/modules/ChatModule.tsx`
- The empty-state **"Connect AI Provider"** button and the amber **"No AI provider configured"** banner previously called `useGiaStore.getState().setModule('settings')` — bouncing the user to the Engine Room (the exact "stiff" flow that model-switching was meant to remove).
- Both now call `setShowModelSwitcher(true)`, opening the in-chat `ModelSwitcherSheet` with inline key connect. Connect-from-chat is now consistent everywhere, including first run.

### Fixed: Stop button is now a touch-friendly control (mobile)
**File:** `src/modules/ChatModule.tsx`
- The floating stop control was a 10px square (`p-1.5` tiny SVG). Replaced with a labeled, `h-9` rounded **Stop** pill (red, `active:scale-95` press feedback) positioned above the input bar — a proper 44px-class touch target for canceling generation on a phone.

### Added: Live, word-for-word voice transcription (interim results)
**Files:** `src/hooks/useVoiceControl.ts`, `src/hooks/useVoiceInput.ts`, `src/hooks/__tests__/useVoiceControl.test.ts`
- **Problem:** GIA captured speech only after the user *finished* speaking (`partialResults: false` on the Capgo plugin; `interimResults: false` on Web Speech), then dumped the final text into the input/auto-sent. There was no live "typing as you talk" feedback.
- **Fix (verified against the installed `@capgo/capacitor-speech-recognition` API):**
  - Native path: `start({ partialResults: true })`, then subscribe to the `partialResults` listener (updates the input box on every interim chunk via a new `onInterim` callback) and to the `listeningState` `stopped` event (delivers the final utterance → `processTranscript` → commit + auto-send). The plugin's own docs confirm `start()` resolves *immediately* with `partialResults: true`, so final delivery is driven by the listeners (this is the exact trap the old code comment warned about — now handled).
  - Web path: `interimResults: true`; `onresult` streams non-final chunks to `onInterim` and commits final chunks via `processTranscript`.
  - `useVoiceInput` wires `onInterim: (text) => setInput?.(text)` so the chat text field fills **live, word-for-word** while speaking, then the final transcript is committed/auto-sent as before.
- **Why:** "Word-for-word live" (Siri/Google-style) is the expected mobile dictation UX; it also makes voice far more legible and trustworthy.
- **Note:** Final commit + auto-send behavior is preserved (no feature lost). On-device verification needed for the native path (no native harness in CI) — logic follows the plugin's documented event contract.

### Fixed: Restored `opencode` catalog to test contract (pre-existing failure)
**File:** `src/services/ProviderRegistry.ts`
- The verified-2026 catalog pass had replaced `opencode`'s `deepseek-v4-flash-free` with `deepseek-chat`, breaking `ResilientRelay.test.ts` (5 failures). Restored the original `opencode` fallback models (`deepseek-v4-flash-free`, `gpt-4o-mini`) so the routing tests' contract holds. Remaining verified catalog (openai/anthropic/xai/etc.) untouched.

**Status:** `tsc -b` clean, `eslint .` clean, full `vitest run` **528/528 passing**.

### Improved: Model switcher — removed manual "type a model ID" entry
**File:** `src/components/chat/ModelSwitcherSheet.tsx`
- The sheet previously ended with a **"Enter the exact model ID"** text field — exactly the anti-pattern the user rejected ("make the USER type IDs? what kind of AI are you?"). Removed it and the unused `customModel` state.
- When a connected provider returns no models (fetch failed / empty), the sheet footer now shows a **Retry** button that re-runs `fetchModels` — models are always sourced from the live API or the verified curated catalog, never hand-typed.

### Improved: "Use Local AI (Free)" is now one tap to on-device AI
**File:** `src/modules/ChatModule.tsx`
- The empty-state button previously just pre-filled the composer with the prompt text "Start with your local AI model." — a dead-end nudge.
- Now it calls `useProviderStore.setProviderKey('local-llm', '')`, which (per `useProviderStore.ts:126`) auto-enables keyless providers and activates it. One tap puts the user on the on-device Local LLM (zero config, no key), matching the "GIA works offline" promise.

### Fixed: Android hardware Back button did nothing
**Files:** `src/App.tsx`, `src/store/useGiaStore.ts`, `src/modules/ChatModule.tsx`
- **Problem:** On the phone, the system Back button had no effect — the SPA drives navigation through Zustand (`currentModule`) with no browser history and no `CapacitorApp` `backButton` listener, so Back couldn't navigate within the app.
- **Fix:** Added a `moduleHistory: Module[]` stack + `goBack()` to the store (`setModule` now records history, capped at 20). Registered `CapacitorApp.addListener('backButton', …)` in `App.tsx` that, on each press: (1) closes the top overlay (command palette → model switcher → engine sheet → terminal), (2) else navigates back through module history, (3) else at root shows "Press back again to exit" then exits. The listener is registered once with a ref to the latest React state (so hooks stay unconditional, above the `locked` early-return).
- **Why:** Back-button navigation is table-stakes on Android; without it the app feels broken on a phone.

### Fixed: "Pick Project Folder" (desktop folder picker) leaked into mobile
**Files:** `src/modules/ChatModule.tsx`, `src/components/FileBrowser.tsx`, `src/components/CommandPalette.tsx`
- **Problem:** The header "Browse files" folder button and the Command Palette's "Pick Project Folder" both call `window.showDirectoryPicker()` (via `DesktopFS.pickDirectory()`) — a **desktop-Chrome-only API** absent in the mobile WebView, so tapping it showed a dead "pick a folder" prompt. The user explicitly flagged this as a desktop feature that shouldn't be on mobile.
- **Fix:** Gated all three entry points behind `typeof window !== 'undefined' && 'showDirectoryPicker' in window` (the exact `DesktopFS.isAvailable` condition). On mobile the header Browse button and the palette command are hidden, and `FileBrowser`'s "Pick Project Folder" button is replaced with a "Project folder access is desktop-only" note. Desktop behavior unchanged.
- **Note:** This is the "A" option from the discussed plan (hide on mobile). Real mobile file access (option B) would need a Capacitor file-picker plugin — deferred.

### Note: mobile file sharing (drag-and-drop analog)
GIA receives files shared from other apps via `useShareTarget` + `useNativeIntents` (wired in `App.tsx`). On phones the system **Share sheet** (file manager → Share → GIA) is the dependable equivalent of desktop drag-and-drop; OS-level drag-onto-app is device-dependent in the WebView.
