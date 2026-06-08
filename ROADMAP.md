# GIA v3 Roadmap — Addressing All Limitations

## Phase 1: Core Architecture (High Impact, Foundation)

### 1. Local Model Support (Ollama / LM Studio)
**Effort:** 2-3 weeks | **Dependencies:** Provider registry refactor

**Approach:**
- Add `local` provider type to `ProviderRegistry`
- Implement `/api/tags` (Ollama) and `/v1/models` (LM Studio) discovery
- Stream via `/api/chat` (Ollama) or OpenAI-compatible `/v1/chat/completions`
- Add model pull/management UI in Engine Room
- Handle GPU/CPU detection for mobile

**Files to touch:**
- `src/services/ProviderRegistry.ts` — add local provider config
- `src/services/providers/local.ts` — new provider implementation
- `src/components/settings/` — Engine Room local model management
- `src/store/useProviderStore.ts` — local provider state

---

### 2. RAG / Document Retrieval with Vector Search
**Effort:** 3-4 weeks | **Dependencies:** Local embeddings or embedding API

**Approach:**
- Add `DocumentStore` with IndexedDB + vector index (HNSW via `hnswlib-wasm` or `vectra`)
- Embedding providers: local (sentence-transformers via WASM) or API (OpenAI, Voyage, Cohere)
- Chunking: semantic (by heading) + fixed-size fallback
- Retrieval: hybrid (vector + BM25 keyword) with re-ranking
- UI: Document browser, chunk preview, citation links in responses

**Files to touch:**
- `src/services/DocumentStore.ts` — new service
- `src/services/EmbeddingProvider.ts` — abstraction
- `src/services/brain/ragRetriever.ts` — retrieval logic
- `src/components/KnowledgePanel.tsx` — document management UI
- `src/tools/rag_search.ts` — new tool

---

### 3. Conversation Branching / Forking
**Effort:** 1-2 weeks | **Dependencies:** Session tree structure

**Approach:**
- Change `Session` from linear array to tree: `messages: MessageNode[]` where `MessageNode = { message: Message; children: MessageNode[]; parentId?: string }`
- UI: Visual branch indicator, "Fork here" in message menu, branch switcher in history
- Storage: Serialize tree to IndexedDB
- Export: Include branch metadata in markdown

**Files to touch:**
- `src/store/useGiaStore.ts` — session tree structure
- `src/components/MessageList.tsx` — branch rendering
- `src/components/chat/MessageContextMenu.tsx` — fork action
- `src/hooks/useChatState.ts` — branch navigation

---

### 4. Parallel Tool Execution
**Effort:** 2-3 weeks | **Dependencies:** Tool runner refactor

**Approach:**
- Detect independent tool calls (no data dependencies)
- Execute in `Promise.allSettled` batches
- Stream partial results via `onThought` as each completes
- Handle mixed success/failure gracefully
- Add `dependsOn` field to tool schema for explicit ordering

**Files to touch:**
- `src/services/brain/toolRunner.ts` — parallel executor
- `src/services/brain/toolSchemas.ts` — dependency metadata
- `src/services/GiaBrain.ts` — pass parallel results to next iteration

---

## Phase 2: Extensibility & Execution (Medium Impact)

### 5. Plugin System for Custom Tools
**Effort:** 3-4 weeks | **Dependencies:** Tool runner, secure sandbox

**Approach:**
- Define `GiaPlugin` interface: `{ id, name, version, tools: Tool[], onLoad?, onUnload? }`
- Plugin manifest: `gia-plugin.json` with permissions
- Sandbox: `vm2` or `isolated-vm` for Node, `eval` with CSP for web
- Registry: Local plugin dir + remote marketplace (GitHub/Gist)
- Hot reload in development

**Files to touch:**
- `src/services/PluginManager.ts` — new service
- `src/services/GiaTools.ts` — dynamic tool registration
- `src/types/plugin.ts` — types
- `src/components/settings/PluginsSection.tsx` — UI

---

### 6. Local Code Execution (WASM / Node)
**Effort:** 3-4 weeks | **Dependencies:** Plugin system (for language runtimes)

**Approach:**
- **WASM:** Pyodide (Python), QuickJS (JS), Wasmer (Rust/C++)
- **Node:** `isolated-vm` with resource limits (CPU, memory, time)
- **Deno:** Subprocess with `--allow-read --allow-write --allow-net`
- Unified API: `executeCode({ language, code, files, timeout })`
- Persistent REPL sessions per conversation

**Files to touch:**
- `src/services/CodeRunner.ts` — unified interface
- `src/services/runners/pyodide.ts`, `quickjs.ts`, `node.ts`, `deno.ts`
- `src/tools/code_execute.ts` — updated tool

---

### 7. Browser Automation
**Effort:** 3-4 weeks | **Dependencies:** Playwright/Puppeteer, headless shell

**Approach:**
- **Desktop:** Playwright via Node subprocess
- **Android:** Chrome DevTools Protocol via `chrome-remote-interface`
- **Web:** Browser extension (MV3) for user's browser
- Tools: `navigate`, `click`, `type`, `extract`, `screenshot`, `pdf`, `wait_for`
- Stealth mode for anti-bot

**Files to touch:**
- `src/services/BrowserAutomation.ts` — abstraction
- `src/services/runners/playwright.ts`, `cdp.ts`, `extension.ts`
- `src/tools/browser_navigate.ts`, `browser_click.ts`, etc.

---

## Phase 3: Platform & Polish (Medium Impact)

### 8. iOS Capacitor Build
**Effort:** 2-3 weeks | **Dependencies:** Capacitor iOS config, Xcode

**Approach:**
- `npx cap add ios` + configure `capacitor.config.ts`
- iOS-specific plugins: `Share`, `SafariViewController`, `BackgroundTask`
- Push notifications via APNs (requires backend)
- TestFlight distribution pipeline
- Handle iOS WebView limitations (no `file://` access, no background JS)

**Files to touch:**
- `capacitor.config.ts` — iOS config
- `ios/App/App/` — native plugins
- `src/services/PlatformService.ts` — iOS detection
- GitHub Actions: iOS build workflow

---

### 9. Background Processing for Scheduled Tasks
**Effort:** 2-3 weeks | **Dependencies:** Platform background APIs

**Approach:**
- **Android:** `WorkManager` + `ForegroundService` for long tasks
- **iOS:** `BGAppRefreshTask` + `BackgroundTasks` framework
- **Web:** Service Worker + Background Sync API (limited)
- Task queue in IndexedDB with persistence
- Battery-aware scheduling (Android `BatteryManager`, iOS `ProcessInfo`)

**Files to touch:**
- `src/services/BackgroundTaskManager.ts` — new service
- `android/app/src/main/java/.../BackgroundWorker.kt`
- `ios/App/App/BackgroundTask.swift`
- `src/services/SchedulerService.ts` — integrate queue

---

### 10. Auto-Summarization for Long Contexts
**Effort:** 1-2 weeks | **Dependencies:** None

**Approach:**
- Trigger when conversation > 70% context window
- Summarize oldest N messages via cheap model (Haiku, Flash, 3.5-turbo)
- Store summary as system message with `summary: true` flag
- Recursive summarization for very long chats
- User can "expand" summary to see original

**Files to touch:**
- `src/services/brain/summarizer.ts` — new service
- `src/services/GiaBrain.ts` — inject before model call
- `src/components/MessageList.tsx` — expandable summary UI

---

## Phase 4: Advanced Features (Lower Priority)

### 11. Multi-Modal Input (Audio/Video)
**Effort:** 2-3 weeks | **Dependencies:** MediaRecorder, FFmpeg.wasm

**Approach:**
- Audio: `MediaRecorder` → WebM → Whisper (local via `whisper.cpp` WASM or API)
- Video: Extract audio track + keyframes → describe with vision model
- Real-time transcription overlay during recording
- Voice activity detection for push-to-talk

---

### 12. Collaboration / Multi-User
**Effort:** 4-6 weeks | **Dependencies:** Backend (WebRTC, WebSocket, CRDT)

**Approach:**
- **Local-first:** Yjs + IndexedDB + WebRTC mesh
- **Server-assisted:** Hocuspocus (Yjs backend) + Supabase/Firebase
- Presence: cursors, selections, typing indicators
- Permissions: owner, editor, viewer
- Conflict resolution: last-write-wins + manual merge

---

## Dependency Graph

```
Phase 1 (Core)
├── 1. Local Models ──────────────────┐
├── 2. RAG ───────────────────────────┤
├── 3. Conversation Branching ────────┼──→ Phase 2
├── 4. Parallel Tools ────────────────┘

Phase 2 (Extensibility)
├── 5. Plugin System ◄────────────────┐
├── 6. Local Code Exec ◄──────────────┤ (needs 5)
├── 7. Browser Automation ◄───────────┘

Phase 3 (Platform)
├── 8. iOS Build (independent)
├── 9. Background Tasks (independent)
├── 10. Auto-Summarize (independent)

Phase 4 (Advanced)
├── 11. Multi-Modal (needs 6 for local Whisper)
├── 12. Collaboration (major backend)
```

---

## Quick Wins (Can Start Today)

| Task | Effort | Impact |
|------|--------|--------|
| Add Ollama provider | 3 days | High — local models |
| Conversation forking | 1 week | High — UX |
| Auto-summarization | 1 week | High — context |
| Parallel tool execution | 2 weeks | High — speed |
| Plugin system design | 1 week | Medium — extensibility |

---

## Recommended Start Order

1. **Local Models** — unlocks everything else (free, private, offline)
2. **Conversation Branching** — UX multiplier, low risk
3. **Auto-Summarization** — solves context limit immediately
4. **Parallel Tools** — 2-3x faster agentic loops
5. **Plugin System** — enables community contributions
6. **RAG** — major feature, builds on embeddings from (1)
7. **Local Code Exec** — builds on plugin sandbox
8. **Browser Automation** — builds on plugin system
9. **iOS / Background** — platform work in parallel
10. **Multi-Modal / Collaboration** — later phases

---

## Notes

- Each phase should ship incrementally behind feature flags
- Maintain backward compatibility with existing sessions
- Write integration tests for each new provider/tool
- Document plugin API before opening to community