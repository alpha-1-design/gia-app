# GIA Comprehensive TODO List

> **Status update (June 2026):** Code audit completed. Multiple items already resolved.

## How GIA Works vs Industry Standard

### P0 — CRITICAL: Bugs That Break Core Functionality

| # | Feature | Status |
|---|---------|--------|
| 1 | **Tool block regex breaks at chunk boundaries** | ✅ **FIXED** — `streamParser.ts` now uses `pendingBacktickCount` state machine to reconstruct partial backtick fences across stream chunks. Chunk-start ` ```tool ` explicitly allowed. |
| 2 | **Two conflicting voice packages** | ✅ **FIXED** — Only `@capgo/capacitor-speech-recognition` is used. |
| 3 | **handsOff default contradicts tool system** | ✅ **FIXED** — `handsOff` defaults to `false`. When `true`, native tool schemas are sent to provider APIs. |
| 4 | **Input bar overlaps streaming content** | ✅ **FIXED** — `ChatModule.tsx` uses dynamic `inputContainerHeight` for scroll padding instead of fixed `pb-28`. |
| 5 | **No input validation on tool arguments** | ✅ **FIXED** — Zod schemas added to all major tools. `toolRunner.ts` calls `validateToolArgs()` before execution. |

### P1 — HIGH: Major Feature Gaps

| # | Feature | Status |
|---|---------|--------|
| 6 | **Fenced code blocks instead of native tool_use** | ✅ **PARTIAL** — Native schemas implemented for OpenAI, Anthropic, Gemini. Fallback text-based mode still uses regex. |
| 7 | **Streaming tool calls are fragile** | ✅ **PARTIAL** — Native streaming `tool_calls` handled for all three major providers. Fallback text-based still uses regex state machine. |
| 8 | **No semantic/vector memory** | ✅ **IMPROVED** — Memory has tiers (working/semantic/episodic), decay, multi-strategy scoring (keyword + cosine similarity + n-gram overlap). Lacks true embeddings. |
| 9 | **Inconsistent `isNative()` gating** | ✅ **PARTIAL** — `featureAvailable()` utility exists. Filesystem tools return clear errors. Some services still lack gating. |
| 10 | **No fallback UI for platform gaps** | ❌ **PENDING** — Settings UI still shows mobile-only features on web. No systematic feature hiding. |

### P2 — MEDIUM: Quality Improvements

| # | Feature | Status |
|---|---------|--------|
| 11 | **Thinking block parsing fragile** | ✅ **FIXED** — `<think>` uses state machine (not regex). |
| 12 | **SchedulerService is dead code** | ✅ **FIXED** — Imported and started in `App.tsx`. |
| 13 | **Tool execution lacks progress/feedback** | ❌ **PENDING** — UI shows generic "thinking..." for all tool calls. No per-tool progress indicators. |
| 14 | **No error recovery in tool loop** | ✅ **FIXED** — `toolRunner.ts` has retry with exponential backoff (max 3 attempts). Structured errors sent to LLM. |
| 15 | **File ops lack safety checks** | ✅ **FIXED** — `isPathSafe()` checks for path traversal. Max file size enforcement. |
| 16 | **Provider abstraction leaks** | ❌ **PENDING** — No capability matrix. No UI indication of which features work on which provider. |
| 17 | **CodeRunner is JS-only, client-side** | ❌ **PENDING** — Still JS-only IFrame sandbox. No Python or server-side execution. |

### P3 — LOW: Nice-to-Haves / Polish

| # | Feature | Status |
|---|---------|--------|
| 18 | **No wake word detection** | ✅ **FIXED** — Porcupine integration in `useWakeWord.ts`. |
| 19 | **No streaming TTS** | ❌ **PENDING** — Still generates full audio before playback. |
| 20 | **No batch voice commands** | ❌ **PENDING** — One utterance at a time. No multi-intent. |
| 21 | **Emoji search is unique but unpolished** | ⬜ — Works as-is. No favorites/quick-access. |
| 22 | **Brain Boost is a gimmick** | ⬜ — Still in tool set. Low priority. |
| 23 | **No analytics / telemetry** | ❌ **PENDING** — Not implemented. |

## Summary

### What GIA Does Better Than Industry
- **Multi-provider**: 9 AI providers in one app — no single-provider app matches this flexibility
- **All-in-one mobile**: Voice + files + code + search + memory + TTS + image gen + PDF in one app — unique mobile AI assistant
- **Unique tools**: `brain_boost`, `emoji_search`, `request_clarification` — novel UX experiments
- **Tool ecosystem**: 35+ tools with extensible framework including MCP — developer-friendly

### What Needs Work
1. Per-tool progress feedback in UI (P2)
2. Provider capability matrix + UI (P2)
3. Streaming TTS (P3)
4. Batch voice commands (P3)
5. Fallback UI for platform gaps (P1)
6. Analytics (P3)
