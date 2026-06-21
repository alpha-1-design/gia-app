# GIA App — Agents Module

## Custom Agents (AgentsModule)

Custom agents are like Gemini Gems or Claude Projects — self-contained AI personas with their own system prompt, toolset, and private knowledge files, all running within GIA.

### Architecture
- **Store**: `src/store/useAgentStore.ts` — Zustand store persisted to IndexedDB with CRUD for custom agents, per-agent file management, chat session storage, and per-agent RAG indexing/search helpers.
- **Module**: `src/modules/AgentsModule.tsx` — Three views (list, chat, create/edit modal).
- **UI entry**: Lazy-loaded in `src/App.tsx` with `Bot` icon in the module selector. CSS variable `--mod-agents: 168, 85, 247` in `globals.css`.
- **System prompt mode**: `systemPromptMode: 'replace'` — agent only knows about its own tools and files.

### Key Features
- **Per-agent RAG**: Documents are indexed with `agent:{agentId}:` namespace prefix in RAGService. `search()` and `listDocuments()` accept an optional `namespace` parameter for isolation.
- **Per-agent tool assignment**: 16 available tools (web_search, filesystem_read, rag_search, code_runner, etc.). Only assigned tools appear in the agent's system prompt.
- **Self-contained chat**: Each agent has its own message list in `useAgentStore.chatSessions[agentId]`. No shared sessions or branches with the main chat.
- **Source citations**: File name + relevance score chips appear below agent responses. Hover shows excerpt.
- **42 avatar icons**: Lucide React icons with per-icon color mappings.

### Animations
- **Cosmic portal empty state**: Animated nebula gradient BG, rotating portal rings, orbiting particles, floating geometric shapes, cosmic rays, word-reveal headline, pulsing create button.
- **Spring physics**: Agent cards use `layout` animations with spring stiffness 300 / damping 30. Modal entrance uses spring damping 28 / stiffness 280 / mass 0.8.
- **Staggered entrances**: Message list items stagger at `idx * 0.04s`. Form fields in modal stagger from 0.08s-0.44s.
- **Source chip bounce-in**: CSS `source-bounce-in` keyframe (scale 0.92 → 1.02 → 1) with stagger delay.
- **Hover effects**: Source chips scale to 1.05 with purple glow shadow on hover. Tooltip slides up with spring easing.
- **Thinking dots**: Three dots with float + glow animation, staggered 0.15s apart.
- **Streaming glow**: Latest streaming message has a subtle purple `box-shadow` aura.
- **Card exit**: Cards exit with blur(4px) + scale(0.92).

## File & Document Reading Tools

GIA has these local on-device tools that do **not** rely on AI providers:

| Tool | File | Scope | Local? |
|------|------|-------|--------|
| `filesystem_read` | `src/services/tools/filesystem.ts` | Reads any file from device filesystem (Android, via Capacitor) | ✅ Yes (native only) |
| `filesystem_write` | `src/services/tools/filesystem.ts` | Writes files to device | ✅ Yes |
| `filesystem_list` | `src/services/tools/filesystem.ts` | Lists directory contents | ✅ Yes |
| `read_document` | `src/services/tools/documents.ts` | Reads DOCX, XLSX, PPTX, ODT, ODS, EPUB, HTML, MD, RTF, CSV, JSON, XML, YAML, plain text — runs Python parser in sandbox | ✅ Yes (needs sandbox server) |
| `download_url` | `src/services/tools/documents.ts` | Downloads any URL to device | ✅ Yes |
| `browse_web` | `src/services/tools/documents.ts` | Fetches and reads web page content | ✅ Yes (needs browser server) |
| `rag_search` | `src/services/tools/rag.ts` | Semantic vector search across indexed documents | ✅ Yes (uses local ONNX embeddings via LocalAI) |

`filesystem_read`/`write`/`list` are fully local via Capacitor Filesystem plugin (Android only).  
`read_document` runs a Python script in the local sandbox server — no network calls to any AI provider.  
`rag_search` uses local ONNX embeddings (`LocalAI.embed()`) — purely client-side.

## Settings Toggles & Injection

### Settings injected into GIA's context
Settings in the store flow into GIA's system prompt (`buildGiaSystem.ts`) or as direct generation options:

| Setting | Where injected | File |
|---------|---------------|------|
| `customInstructions` | System prompt footer | `buildGiaSystem.ts:289` |
| `handsOff` | Controls tool approval note + native schema skipping | `buildGiaSystem.ts:93` |
| `pinnedMemories` | System prompt memory section | `buildGiaSystem.ts:75` |
| `userProfile` | System prompt user context | `buildGiaSystem.ts:37` |
| `webSearch` | `useWebSearch` option to GiaBrain | `useChatGeneration.ts:219` |
| `extThinking` | `useExtendedThinking` option + temperature control | `useChatGeneration.ts:220` |
| `localVision` | Disables vision model switching | `GiaBrain.ts:84` |
| `responseCache` | Caches/reuses responses | `GiaBrain.ts:69` |
| `outputValidation` | Sanitizes provider output | `GiaBrain.ts:207` |
| `smartFallback` | Smart provider failover | `GiaBrain.ts:151` |
| `localSummarize` | Controls auto-summarization of long context | `useChatGeneration.ts:178` |
| `inputGuardrails` | Prompt safety check before generation | `useChatGeneration.ts:109` |

### Settings page
- **ReliabilitySection**: Smart Fallback, Response Cache, Input Guardrails, Output Validation, Local Summarization — all wired to store.
- **DeveloperSettings**: Smart Fallback, Output Validation, Response Cache (read from store directly — no desync).
- **ChatModule feature bar**: Web Search, Extended Thinking, Hands-off, Local Vision (toggles only in chat, not in Settings page).
- **KnowledgePanel**: Custom Instructions (textarea, save button).

### Persistence
The following survive page reloads via IndexedDB (`partialize` in `useGiaStore.ts`): sessions, `webSearch`, `extThinking`, `handsOff`, `localVision`, `localSummarize`, `responseCache`, `inputGuardrails`, `outputValidation`, `smartFallback`, `customInstructions`, theme, wake word settings, voice settings.

## Generation Continuity (Anti-Hang)

When the user switches modules or leaves the app during an active generation:

1. **No abort on unmount**: `useChatState.ts` no longer aborts the AbortController on component unmount (removed).
2. **Store-level tracking**: `generationState` in `useGiaStore` tracks `{ active, module, sessionId, messageId }` so the in-progress state survives module switches.
3. **Background message updates**: The `onStream` callback calls `state.updateMessage()` which writes to the store (persisted to IndexDB with 300ms debounce). Even when the component is unmounted, messages continue to update.
4. **Desktop notifications**: When generation completes and the user is on a different module, `DesktopNotifications.notify()` fires a browser notification. On Android, `LocalNotifications.schedule()` fires a native notification.
5. **Agent notifications**: Same flow for agent chat — notification fires when `currentModule !== 'agents'`.

## Commands
```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build (typecheck THEN build — never skip)
npm run lint       # eslint .
npm run test       # vitest (watch mode)
npm run test:run   # vitest run
npm run preview    # vite preview
npm run cap:sync   # npx cap sync android (run after build for Android)
```
