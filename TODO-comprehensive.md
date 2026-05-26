# GIA Comprehensive TODO List

## How GIA Works vs Industry Standard

### P0 — CRITICAL: Bugs That Break Core Functionality

| # | Feature | GIA Way | Industry Way (Anthropic/Gemini/Grok/OpenAI) | The Fix |
|---|---------|---------|---------------------------------------------|---------|
| 1 | **Tool block regex breaks at chunk boundaries** | `/```tool\n([\s\S]*?)\n```/` — requires `\n` before ```tool. When an AI response starts with a tool block and no leading newline (e.g., first chunk of stream = ````tool\nsearch...`), the regex silently misses it. Also, ````tool` can split across two stream chunks (` ``` `` ` + `` `tool `` `). | **Anthropic**: Native `tool_use` content blocks in structured JSON. No regex. **OpenAI**: `tool_calls` delta in streaming — structured JSON fields, not text. **Gemini**: `functionCall` content parts. | Rewrite `processStreamChunk` to detect ````tool` anywhere (not just after `\n`) and use a state machine to accumulate partial blocks across chunks. |
| 2 | **Two conflicting voice packages** | `useVoiceControl.ts` imports `@capgo/capacitor-speech-recognition`. `AmbientInput.tsx` imports `@capacitor-community/speech-recognition`. Both are installed in `package.json`. These are the same plugin — Capgo is a fork of Community that adds punctuation; they share native IDs and will clash at build time. | Single integrated voice pipeline: one STT plugin, one wake-word detector (e.g., Porcupine 97.1% accuracy). No duplicate registrations. | Remove one. Keep `@capgo/capacitor-speech-recognition` (it's the maintained fork with punctuation). Update `AmbientInput.tsx` to use `useVoiceControl` hook instead of duplicating mic logic. |
| 3 | **handsOff default contradicts tool system** | `handsOff` defaults to `true` in `useGiaStore.ts`. When true, tools cannot execute — they return a "handsFree mode" message. But the system prompt in `GiaBrain.ts` still registers all 10 tools and tells the LLM about them. The LLM tries to use tools, they silently fail, conversation quality degrades. | No provider has this concept. Tools are either registered and executable, or they're absent. No runtime gate. | Change default to `false`. Or: exclude tool definitions from the API request entirely when `handsOff === true` instead of registering them as stubs. |
| 4 | **Input bar overlaps streaming content** | Chat input is `absolute bottom-3 left-3 right-3 z-10`. Scroll area is `pb-28`. When the input bar grows (multi-line text), the padding doesn't adjust — streaming content scrolls behind the input before becoming visible. | ChatGPT/Claude use dynamic scroll padding that resizes as the input grows. | Replace fixed `pb-28` with a dynamic value computed from the input textarea's `scrollHeight`. Use `onInput` resize callback to update padding. |
| 5 | **No input validation on tool arguments** | Tools receive `args` as raw parsed JSON. No schema validation before execution. If the LLM sends `"path": 123` (number instead of string), `filesystem_read` silently fails. | Anthropic/OpenAI validate tool call arguments server-side against the JSON Schema provided in the tool definition. Bad args return structured error. | Add JSON Schema validation (`zod` or `ajv`) to each tool's `execute()` that validates args before running. Return structured error to LLM on failure. |

### P1 — HIGH: Major Feature Gaps

| # | Feature | GIA Way | Industry Way | The Fix |
|---|---------|---------|-------------|---------|
| 6 | **Fenced code blocks instead of native tool_use** | GIA injects tool definitions into the system prompt as text descriptions. The LLM outputs ````tool\n{json}\n````. Regex extracts the JSON. This works with well-trained models but has no API-level schema enforcement. | All four providers support native JSON tool/function schemas in the API request. The model returns structured `tool_use` / `tool_calls` / `functionCall` objects natively — no text parsing needed. | Add provider-specific native tool formatting to `GiaBrain.ts`: `buildAnthropicTools()`, `buildOpenAITools()`, `buildGeminiTools()`, `buildGrokTools()`. Fall back to fenced blocks only for unsupported providers (Ollama, DeepSeek, Mistral). |
| 7 | **Streaming tool calls are fragile** | `processStreamChunk` builds a text buffer and checks for ````tool` marker. If a chunk arrives mid-block, the buffer accumulates and re-checks on next chunk. But the regex only fires on complete blocks — no incremental/partial handling. | **OpenAI**: Streaming `tool_calls` deltas with `index` field. Client accumulates `function.arguments` string by matching `index`. **Anthropic**: `content_block_start` / `content_block_delta` / `content_block_stop` events. **Gemini**: Streaming `functionCall` parts. | For providers with native streaming tool calls, use provider-specific stream parsing. For fallback providers using fenced blocks, implement a proper state machine (not regex) that tracks partial blocks across chunks. |
| 8 | **No semantic/vector memory** | `memory_store` tool writes to a flat array of `{text, keywords, priority}`. Retrieval is keyword-overlap matching. 200-entry hard cap. No memory consolidation or forgetting. | Anthropic: Tiered memory (working/episodic/semantic) via external systems. Gemini: Context caching + native file API. OpenAI: Vector stores + Assistants API threads. General: Embedding-based semantic search with decay. | Add embeddings (use a local model or API). Replace keyword matching with cosine similarity. Add memory tiers: working (current session), semantic (facts), episodic (summarized history). Add decay/tTL. |
| 9 | **Inconsistent `isNative()` gating** | Some features check `isNative()` (Capacitor platform check) before executing, some fail silently, some throw. No user-facing message when a feature is unavailable on web. | N/A — providers are platform-specific by design. | Audit all service calls. Create a `FeatureGate` utility that checks `isNative()` and returns a user-friendly message: `"X is only available on mobile devices"`. Add to: filesystem ops, biometrics, voice, TTS, code runner. |
| 10 | **No fallback UI for platform gaps** | When running in browser (not native), file operations, voice, and biometrics fail silently or throw unhandled errors. No graceful degradation. | Web-first or native-only by design, never hybrid-with-gaps. | Add platform detection at app init. Show feature availability in settings. Disable/hide mobile-only features when running on web. |

### P2 — MEDIUM: Quality Improvements

| # | Feature | GIA Way | Industry Way | The Fix |
|---|---------|---------|-------------|---------|
| 11 | **Thinking block parsing same as tool blocks** | `processStreamChunk` uses the same regex approach for ````thinking` / ````thought` blocks. Same chunk-boundary fragility. Missing partial blocks at stream start. | **Claude**: Native `thinking` content block in streaming API — structured field. **ChatGPT**: `reasoning_tokens` SSE events. **Gemini**: `thought` flag on content parts. | For providers supporting native thinking (Anthropic, OpenAI reasoning models), extract from structured API response. For fallback providers, fix regex to match at chunk boundaries without requiring `\n`. |
| 12 | **SchedulerService is dead code** | `SchedulerService.ts` is a 90-line wrapper around Capacitor Background Task. It is never imported or instantiated anywhere in the codebase. | Server-side scheduling (cron, Pub/Sub). Mobile apps don't typically schedule AI tasks. | Either implement scheduling (add UI + store integration) or remove the file. If keeping, register it in the app initialization. |
| 13 | **Tool execution lacks progress/feedback** | Tools execute synchronously (or with single await). UI shows generic "thinking..." animation for all tool calls — no per-tool progress. | **Claude Computer Use**: Shows screenshots step by step. **ChatGPT Code Interpreter**: Shows code execution output as it runs. **Gemini**: Shows function call info. | Add per-tool status reporting. Long-running tools (web_search, terminal_run) should emit progress via the store. Show tool name and status in the chat UI. |
| 14 | **No error recovery in tool loop** | When a tool throws, `GiaBrain.ts` catches the error and may or may not inform the LLM. The loop can get stuck if tool keeps failing. | Anthropic/OpenAI: Tool errors result in structured `tool_result` / `tool_call_error` content blocks — the model can adapt. | Add retry logic with exponential backoff (max 3 retries for transient errors). Send structured error back to LLM so it can correct its approach. |
| 15 | **File ops lack safety checks** | `filesystem_read` / `filesystem_write` accept any path. No path traversal check (`../../../etc/passwd`). No file size limits. No MIME type validation. | Anthropic: No FS access. Gemini: Controlled file upload API with validation. OpenAI: Sandboxed. | Add path validation (reject if contains `..`). Add max file size (e.g., 10MB). Add allowed-directories whitelist. |
| 16 | **Provider abstraction leaks** | `switch(selectedProvider)` in `GiaBrain.ts` has per-provider branches. Different providers support different features (tools, thinking, streaming, images). Not all features work on all providers. User has no way to know what works on their chosen provider. | Single-provider SDKs — all features are known to work. | Add a capability matrix to provider config. Show supported features in provider selector UI. Gracefully fall back when a feature isn't supported. |
| 17 | **CodeRunner is JS-only, client-side** | `CodeRunner.ts` creates an IFrame sandbox and `eval()`s JavaScript. No Python, no server-side execution. Limited computation. | OpenAI Code Interpreter: Server-side Python. Gemini Code Execution: Server-side. Claude: Computer Use sandbox. | Add optional server-side code execution (WebContainer, or API-based). Show a warning when running client-side code. Add timeout enforcement. |

### P3 — LOW: Nice-to-Haves / Polish

| # | Feature | GIA Way | Industry Way | The Fix |
|---|---------|---------|-------------|---------|
| 18 | **No wake word detection** | Voice activation requires button press. No "Hey GIA" wake word. | Porcupine (97.1% accuracy), Snowboy, or custom wake word models. | Add Porcupine integration (runs on-device, free for up to 3 wake words). Tie to voice control activation. |
| 19 | **No streaming TTS** | `TTSService.ts` generates full audio file before playing. No chunked/streaming playback. | ElevenLabs, OpenAI TTS: Streaming audio — plays as it generates. | Add audio chunk streaming. Play first chunk while generating rest. Reduces perceived latency. |
| 20 | **No batch voice commands** | Voice control processes one utterance at a time. No multi-intent or chained commands. | Speech-to-intent pipelines map directly to actions without NLU middle layer. | Use the LLM for complex NLU, but add a direct command map for common actions (scroll, go back, open settings) that bypasses LLM for speed. |
| 21 | **Emoji search is unique but unpolished** | `emoji_search` tool exists — searches emoji by keyword. Works, but no other provider has this. | N/A — unique GIA feature. | Keep it. Add to quick-access toolbar. Let users favorite emojis. |
| 22 | **Brain Boost is a gimmick** | `brain_boost` tool injects motivational messages into system prompt ("You can do it!"). Novel but confusing. | No equivalent. | Move to a separate "motivation" module. Don't include in standard tool set. |
| 23 | **No analytics / telemetry** | No usage tracking, error reporting, or performance monitoring. | All providers have extensive telemetry. | Add optional telemetry with user consent. Track: tool usage frequency, error rates, response times, provider usage. |

## Summary

### What GIA Does Better Than Industry
- **Multi-provider**: 9 AI providers in one app — no single-provider app matches this flexibility
- **All-in-one mobile**: Voice + files + code + search + memory + TTS + image gen + PDF in one app — unique mobile AI assistant
- **Unique tools**: `brain_boost`, `emoji_search`, `request_clarification` — novel UX experiments
- **Tool ecosystem**: 10 tools with extensible framework — developer-friendly

### What Needs Urgent Fixing
1. Tool block regex misses blocks at stream chunk boundaries (P0)
2. Two conflicting voice plugins will fail at build (P0)
3. handsOff default breaks user expectation (P0)
4. Input bar overlap with long messages (P0)
5. No native tool_use API — brittle text parsing (P1)
6. No vector/semantic memory — keyword matching is weak (P1)

### Priority Order
1. Fix bugs (P0 items 1-5) — 2-3 days
2. Implement native tool schemas (P1 item 6) — 3-5 days
3. Add streaming tool call handling (P1 item 7) — 2-3 days
4. Memory system overhaul (P1 item 8) — 3-5 days
5. Platform consistency (P1 items 9-10) — 1-2 days
6. Quality improvements (P2 items 11-17) — 5-7 days
7. Polish features (P3 items 18-23) — ongoing
