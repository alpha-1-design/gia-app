# GIA Development Log

Chronological record of changes, rationale, and decisions.

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