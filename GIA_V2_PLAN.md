# GIA v2 — Full Upgrade Plan

> **16 pillars to make GIA robust, personal, and truly powerful**
> Everything builds on what exists — no rewrites.

---

## Phase 0 — Foundation (prerequisites for everything else)

| # | Item | What it enables |
|---|------|-----------------|
| 0a | **Storage layer** — SQLite via `@capacitor-community/sqlite` or IndexedDB with walrus wrapper | Persistence for everything below |
| 0b | **Tool system v2** — typed inputs/outputs, permission system, lifecycle hooks | All new tools depend on this |
| 0c | **Background service** — Capacitor background task + foreground service (Android) | Scheduled tasks, push, daemon |

**Estimate:** 1 sprint

---

## Phase 1 — Robustness (can't break)

### 1. Graceful degradation
```
OpenCode/Zen down → cached response → local model → "offline mode"
```
- Provider health checks (every 30s)
- Response cache (stale-while-revalidate)
- Automatic failover: primary → fallback → local LLM → offline prompt

### 2. Retry + backoff
```
429 or 5xx → wait 1s → 2s → 4s → 8s → max 5 retries → alert user
```
- Exponential backoff with jitter (in provider layer)
- Circuit breaker (after 5 failures, skip provider for 60s)

### 3. Session recovery
- Auto-save conversation state to storage every N messages
- On app restart: "You had a crash. Resume where you left off?"
- Optimistic writes — never lose a message

### 4. Background daemon (live 24/7)
Already scaffolded in `daemon/` — needs:
- Proper install flow (one-tap from GIA UI)
- Auto-start on boot (Android foreground service)
- Daemon ↔ GIA IPC (shared config + logs)

---

## Phase 2 — Personality (feels alive)

### 5. Memory of YOU (RAG)
```
GIA remembers: your name, projects, past decisions, preferences, past conversations
```
- **Embedding store** — local vector DB (Chromadb or pgvector or simple HNSW)
- **Per-conversation embeddings** — each exchange gets embedded on save
- **Persona profile** — extracted preferences + communication style
- **Retrieval** — before every response, search memory for relevant context
- Tech: `@xenova/transformers` for embeddings (already in deps) → local inference

### 6. Adaptive persona
```
Detects: user is terse → be terse. User is formal → be formal.
```
- Stylometric tracking (sentence length, emoji use, greeting patterns)
- Persona config stored in memory profile
- System prompt adjusts based on detected style

### 7. Proactive context
```
"Good morning. You have 3 unread messages. Weather is 22°C. Want me to catch you up?"
```
- Time-aware, notification-aware, device-state-aware
- Context module aggregates: time, location, unread counts, battery, recent apps
- Injected into system prompt as situational context

### 8. Feedback loop
```
"Did that help?" → thumbs up/down → adjusts behavior
```
- Rating UI on every response
- Feedback stored → used to adjust persona, model selection, response length
- Simple: good response → reinforce. Bad → adjust.

---

## Phase 3 — Power (can DO things)

### 9. Device control tools
```
GIA can: send SMS, open apps, change settings, read notifications, make calls
```
Each tool wires a Capacitor plugin:
| Capability | Plugin | Status |
|-----------|--------|--------|
| Send SMS | `@capacitor-community/sms` | New dep |
| Make calls | `@capacitor-community/call` | New dep |
| Read notifications | `@capacitor-community/notification-listener` | New dep |
| Clipboard | `@capacitor/clipboard` | Already installed |
| Haptics | `@capacitor/haptics` | Already installed |
| Share | `@capacitor/share` | Already installed |
| Geolocation | `@capacitor/geolocation` | Already installed |
| Biometric auth | `@capgo/capacitor-native-biometric` | Already installed |

Most deps are **already in package.json** but no GIA tools exist for them.

### 10. MCP (Model Context Protocol)
```
GIA connects to MCP servers for: filesystem, git, databases, browser, etc.
```
- MCP client wrapping `@modelcontextprotocol/sdk` (already in deps!)
- Tool discovery: `mcp_connect <url>` → auto-registers MCP tools into GiaTools
- Built-in MCP servers: filesystem, shell (for Termux), fetch

### 11. Scheduled tasks
```
"Remind me tomorrow at 9am to check CI"
```
- Cron engine inside GIA (setInterval + persistence)
- `cron_add`, `cron_list`, `cron_remove` tools
- Fires at scheduled time → GIA sends a proactive message

### 12. Plugin marketplace
```
Community tools that install with one tap.
```
- Plugin manifest format (metadata + tool definitions)
- Plugin registry (GitHub repo of manifests)
- In-app installer: browse → tap → downloaded + registered
- Sandboxed execution (same as current GiaTools)

### 13. On-device RAG (docs/notes)
```
GIA searches your notes, saved articles, past conversations
```
- Import: markdown files, web clippings, notes
- Embed + index locally
- Search via `note_search <query>` tool

### 14. Voice-native
```
"Hey GIA" → voice prompt → voice response
```
- Speech recognition: `@capgo/capacitor-speech-recognition` (already installed)
- Wake word: Porcupine or local keyword spotter
- Voice trigger → same chat pipeline → TTS response

### 15. Webhook receiver
```
GitHub pushes, CI failures, RSS, crypto → auto-notify GIA
```
- Expose a public URL (via daemon or Cloudflare Tunnel)
- `webhook_register <URL> <event>` → GIA receives webhook → processes
- Can trigger proactive responses ("Deploy failed on main!")

### 16. Push notifications
```
Messages from GIA arrive as push when app is backgrounded
```
- `@capacitor/local-notifications` (already installed)
- Gateway daemon sends push when new message arrives
- Tapping notification opens GIA to that conversation

---

## Timeline estimate

| Phase | Items | Effort | Dependencies |
|-------|-------|--------|-------------|
| 0 | Storage, Tool v2, Background | 1 sprint | None |
| 1 | Graceful, Retry, Session, Daemon | 1 sprint | Phase 0 |
| 2 | Memory, Persona, Context, Feedback | 2 sprints | Phase 0-1 |
| 3 | Device tools, MCP, Cron, Marketplace, RAG, Voice, Webhooks, Push | 3-4 sprints | Phase 0-2 |

**Total: ~3-4 months of focused work** (faster if parallelized)

---

## Where I'd start

Phase 0 first — storage and tool v2 unlock everything. Then jump to:

1. **Memory + RAG** (biggest personality gain per hour)
2. **Device control tools** (biggest power gain per hour)
3. **MCP** (unlocks the entire ecosystem)

Want me to dive into any of these? I can start coding immediately on whichever you pick.
