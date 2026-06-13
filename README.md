# GIA v2.3.1.0 — Generative Interface Agent

<div align="center">

[![CI](https://github.com/alpha-1-design/gia-app/actions/workflows/ci.yml/badge.svg)](https://github.com/alpha-1-design/gia-app/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.3.1.0-emerald.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web-blue.svg)](capacitor.config.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)

**GIA (Generative Interface Agent)** — private, on-device AI workspace. No backend, no telemetry, no cloud dependency except the AI API calls you configure.

[Explore Manual](./manual.md) · [Report Bug](./gia-bug-report.md) · [Contributing](./CONTRIBUTING.md)

</div>

---

## 🚀 Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript 5.7, Tailwind CSS, Framer Motion |
| **State** | Zustand (persisted to IndexedDB via `idb-storage`) |
| **Mobile Shell** | Capacitor (Android WebView) |
| **Build** | Vite |
| **Charts** | Recharts |
| **Diagrams** | Mermaid (loaded on-demand from CDN) |
| **Math** | KaTeX (loaded on-demand from CDN) |
| **Wake Word** | Porcupine by Picovoice (on-device DNN, no audio leaves the phone) |

---

## 🤖 Supported Providers

GIA connects directly to provider APIs — no proxy, no middleman:

- **Anthropic** — Claude 3.5/3.7 with extended thinking
- **Gemini** — Flash/Pro 1.5 & 2.0 with vision
- **OpenAI** — GPT-4o, o1, o3, o4-mini (with reasoning_effort)
- **Groq** — Ultra-fast Llama-3/Mistral inference
- **OpenRouter** — 100+ models (DeepSeek, Llama, etc.)
- **OpenCode** — Specialized coding provider

---

## 🎙 Wake Word System

GIA uses **Porcupine** by Picovoice — an on-device deep neural network wake word engine:

- **100% offline** — all audio processing stays on your phone. No audio data is ever sent to any server.
- **Foreground Service** — on Android, GIA runs a persistent foreground service with a notification, keeping the wake word detector alive even when the app is backgrounded.
- **Auto-restart** — after a device reboot, the wake word service automatically restarts via `BOOT_COMPLETED` receiver.
- **Porcupine DNN** — trained on real-world environments with 97%+ accuracy. Adjustable sensitivity (0–1) to tune false positives vs. misses.
- **Custom wake word** — the shipped fallback uses `JARVIS` (a free built-in Porcupine keyword for testing). To use a custom "Hey GIA" model, train one at [Picovoice Console](https://console.picovoice.ai/) and place the `.ppn` file in `android/app/src/main/assets/`.

### Why `JARVIS` appears in the code

Porcupine ships with free built-in keywords (`HEY_GOOGLE`, `COMPUTER`, `ALEXA`, `JARVIS`, etc.) for development/testing without training a custom model. The code uses `JARVIS` as the default keyword. The JS configuration on the settings page still shows "hey gia" — the two are independent:
- The **JS-side** wake word ("hey gia") is used by the browser-based fallback (regex on STT transcript)
- The **native** Porcupine keyword (`JARVIS`) is used by the Android foreground service
- Once a custom "Hey GIA" `.ppn` model is trained and deployed, Porcupine switches to it automatically

### UX Flow — What happens when you say "Hey GIA"

1. Porcupine's DNN processes the live audio stream (16kHz, on-device)
2. On detection → the foreground service fires a `wakeWordDetected` event to GIA's WebView
3. A short **audio beep** plays (880 Hz sine tone, 150ms)
4. A notification "Wake word detected" appears in the UI
5. GIA immediately starts a **speech-to-text session** to capture your command
6. The transcribed text is **polished** (grammar, punctuation) via AI
7. The polished text appears in the chat input field
8. GIA processes the query autonomously

*Note: a full-screen voice overlay with animated waveform (similar to Siri/Gemini) is planned for a future release.*

---

## ✨ Features

| Area | Details |
|------|---------|
| **Agentic Loop** | Autonomous reasoning with multi-turn tool execution, sub-agent delegation |
| **Live Reasoning** | Real-time streaming thought panel during generation |
| **Deep Memory** | On-device persistent memory with relevance scoring, auto-extraction, pinning, and manual fact management |
| **Custom Instructions** | User-defined rules injected into every conversation system prompt |
| **Voice** | Wake-word ("Hey Gia"), push-to-talk, transcript polishing, TTS |
| **Web Search** | DuckDuckGo with formatted citations and clickable source badges |
| **File Operations** | Read/write files (native + desktop), ZIP bundling, download triggers (browser) |
| **Code Execution** | Run Python/JS/C++ via Piston API, auto-fix on error |
| **Image Generation** | DALL-E 3 / OpenRouter image models, inline display in chat |
| **Skills System** | Role-based presets (Tutor, Developer, Researcher, Creative, Security) |
| **Knowledge Manager** | Browse, search, filter, pin, add, delete, import, export memories |
| **Conversation Search** | Search across session titles and message content with match count |
| **Autonomous Goals** | Create goals → auto-decompose → execute steps → reflect on outcomes |
| **Conversation Branching** | Tree-based branching and forking from any message |
| **MCP Support** | Model Context Protocol — extend tools via external MCP servers (SSE/stdio) |
| **Plugin System** | Hook-based plugin architecture with tool registration API |
| **Scheduled Tasks** | Hourly/daily/weekly background AI task execution |
| **Circle-to-Search** | Screen capture → region select → AI vision analysis |
| **Brain Export/Import** | Full memory backup and restore as JSON |
| **Deep Links** | `gia://` and `web+gia://` protocol handling |
| **PWA Share Target** | Receive shared content from other apps |
| **Clipboard Monitor** | Detects copied text with "Ask GIA" toast |
| **Clarification System** | Structured Q&A when input is ambiguous |
| **Protocol System** | Tool execution approval workflow (auto-confirm low-risk, require OK for high-risk) |
| **Extended Thinking** | Configurable reasoning budget for o1/o3/o4-mini and Gemini models |
| **Input Guardrails** | Prompt injection detection, dangerous command blocking, URL safety checks |
| **Output Validation** | Auto-repair malformed JSON, missing fences, repeated text patterns |
| **Smart Fallback** | Automatic provider failover based on latency/error tracking |
| **Response Caching** | Cache identical requests to reduce API costs |
| **Notes System** | Full sticky notes with colors, tags, pinning, search, and AI-manageable CRUD |
| **On-Device Local AI** | Text classification, summarization, translation, embeddings, and QA — all in-browser, no API call needed |
| **On-Device LLM** | Run Qwen2.5 generative LLMs (0.5B–3B) locally via Transformers WASM — full text generation offline |
| **On-Device Python (Pyodide)** | Run Python code locally via Pyodide WASM — no server required |
| **On-Device Vision** | Local image captioning, OCR, object detection, and classification + automatic provider fallback |
| **Voice Overlay** | Animated full-screen voice UI with waveform visualization and ripple rings |
| **Setup Wizard** | First-run onboarding with step-by-step provider setup, API key entry, and connection testing |
| **Native Device Integration** | Make calls, send SMS/WhatsApp/email, share content, read/write clipboard, trigger vibration |
| **Social Media Manager** | Post, schedule, and analyze across 7 platforms (X, Instagram, Facebook, LinkedIn, TikTok, Telegram, WhatsApp) with OAuth |
| **API Gateway** | Configurable HTTP proxy with route management, logging, rate limiting, and caching |
| **Connector System** | 11 pre-built API connectors (OpenWeatherMap, GitHub, Twilio, Supabase, etc.) with key management |
| **Telegram Channel Integration** | Full Telegram bot channel management — post text, photos, fetch stats |
| **Provider Health Monitoring** | Per-model latency, success rate, degradation detection with live Engine Room status |
| **JSON Retry System** | Exponential backoff + output validation for LLM JSON parsing failures |
| **Auto-Summarization** | Automatic conversation history compression when approaching context limits |
| **Offline Queue** | Persistent tool call queue — queues requests when offline, auto-replays on reconnect |
| **GitHub Integration** | Fetch GitHub user profiles, repos, files, and metadata directly from chat |
| **Screen Capture** | Multi-strategy screenshot capture (native Capacitor, html2canvas, getDisplayMedia) |
| **Biometric Lock** | Optional fingerprint / face unlock via native biometric API |
| **Device Health** | Storage, battery, memory monitoring with risk alerts |
| **Directions & Maps** | Turn-by-turn routing (OSRM) with interactive map rendering |
| **Memory CRUD Tools** | `save_memory`, `forget_memory` with category filtering |
| **Build Project** | Scaffold, build, and package code projects into download-ready ZIP |
| **Install Skill** | Dynamically install skill definitions from URL or built-in registry |
| **Module Resilience** | Exam/Planner/Analyst modules auto-save state to localStorage — survive navigation, use cached/fallback data when offline |
| **Network-Aware Retry** | `generateWithRetry` detects offline state, waits for reconnection, provides clearer error messages with provider-switch hints |
| **Scheduled Post Auto-Publish** | SchedulerService checks and publishes due social posts automatically |
| **Autonomy Hanging Detection** | ProactiveEngine marks steps stuck >5min as failed, reduces check interval to 30s |
| **CI Signed APK Builds** | Keystore generated during CI — release APK is ready to sideload |
| **Granular Notifications** | Schedule, cancel, list, and check permissions for native push notifications |
| **Geolocation Tools** | Watch position, clear watch, check/request permissions |
| **Haptic Patterns** | Impact, notification, and vibration haptic feedback types |
| **Gateway Daemon** | Background daemon for continuous gateway operations |
| **Terminal Management** | Check status and kill proot terminal sessions |

### Interactive Visual Blocks

GIA can render rich interactive visualizations in chat using ` ```visual ` code blocks:

| Type | Tag | Example |
|------|-----|---------|
| **Charts** | `chart` | Bar, line, pie, area charts via Recharts |
| **Data Tables** | `table` | Sortable, copyable data tables |
| **Mind Maps** | `mindmap` | Tree/radial diagrams |
| **Timelines** | `timeline` | Chronological event displays |
| **Code Diffs** | `diff` | Side-by-side code comparison |
| **Image Galleries** | `gallery` | Grid image layouts |
| **Terminal Output** | `terminal` | ANSI-colored terminal output |
| **Metric Widgets** | `widget` | KPI metric cards |
| **Document Outlines** | `outline` | Tree/table-of-contents views |
| **Maps** | `map` | Interactive Leaflet/OpenStreetMap |
| **Audio Waveforms** | `waveform` | Audio visualization |

### Markdown Rendering

| Feature | Support |
|---------|---------|
| **Mermaid diagrams** | ` ```mermaid ` renders as SVG (flowcharts, sequence, Gantt) |
| **KaTeX math** | `$...$` and `$$...$$` rendered beautifully |
| **SVG inline** | ` ```svg ` renders live SVG |
| **Task lists** | `- [x]` checkable checkboxes |
| **Collapsible sections** | `<details><summary>` expand/collapse |
| **Tables** | Rich tables with copy button and row hover |
| **Footnotes** | `[^1]` references with back-links |
| **Definition lists** | `term` / `: definition` rendering |
| **Images** | `![alt](url)` inline display |
| **Inline code** | Click-to-copy with visual feedback |
| **Highlight** | `==text==` for highlighted spans |
| **Colored spans** | `<span style="color:...">` inline HTML |

### UI Improvements

- Floating stop button during generation
- Phase badges: Thinking… → Generating… → Done
- Model footprint on assistant messages (`via gpt-4o`)
- Streaming cursor (blinking `▋`) during token delivery
- Transparent input area with backdrop blur
- Empty state spacing for new chats
- **Context menus** — right-click or long-press on messages for copy/edit/retry/fork/delete/continue
- **Live thinking panel** — per-message collapsible reasoning trace with real-time streaming

---

## 🧩 Model Context Protocol (MCP)

GIA supports the **Model Context Protocol** for extending tool capabilities via external MCP servers:

- **Transport**: SSE (Server-Sent Events) and stdio transports
- **Auto-discovery**: Automatically detects GIA Stdio Bridge at `localhost:3080`
- **Dynamic tool registration**: MCP server tools are registered/unregistered on connect/disconnect
- **Management UI**: Configure servers in Settings → MCP
- **Default servers**: Pre-configured entries for local bridge and Ollama

MCP tools appear in GIA's tool registry with an `mcp__` prefix and are callable from the agentic loop.

## 🤖 Autonomous Agent System

GIA includes a full autonomous goal execution engine:

- **Goal Creation**: Accept high-level goals, automatically decompose into actionable steps
- **Immediate Execution**: First step begins immediately on goal creation (no idle wait)
- **Step Execution**: Each step executed with tool access, LLM reasoning, and result evaluation
- **Hanging Step Detection**: Steps stuck `in_progress` for >5 minutes auto-marked as failed with notification — engine moves to next step
- **Reflection Engine**: Post-execution self-evaluation (success/partial/failure) with lessons learned
- **Proactive Mode**: Background execution during user idle time (configurable 60s threshold)
- **Rapid Polling**: ProactiveEngine checks every 30s for pending work
- **Progress Tracking**: Visual progress bars, step-by-step status, reflection history
- **Priority System**: Low/Medium/High/Critical with automatic ordering
- **Management UI**: Dedicated Autonomy module with create/edit/pause/resume/delete controls

## 🔌 Plugin System

Extend GIA's capabilities through a hook-based plugin architecture:

- **Plugin API**: `registerTool`, `unregisterTool`, `addNotification`, store access
- **Lifecycle Hooks**: `onInit`, `onActivate`, `onDeactivate`, `onBeforeGenerate`, `onAfterGenerate`, `onToolRegister`
- **Persistence**: Plugin enable/disable state persisted across sessions
- **Management**: Install, enable, disable plugins via Settings → Plugins
- **Tool Registration**: Plugins can register custom tools dynamically

## 🗂 Conversation Branching & Forking

Full tree-based conversation management:

- **Branching**: Create named branches from any message to explore alternative paths
- **Forking**: Fork an entire session at any message into a new independent session
- **Branch View**: Visual tree explorer showing conversation topology
- **Branch Management**: Rename, delete, and switch between branches seamlessly
- **Undo Delete**: 5-second undo toast for accidental message deletions

## 💾 Scheduler Service

Schedule periodic AI tasks that run automatically:

- **Intervals**: Hourly, daily, weekly scheduled prompts
- **Execution**: Runs via GIA Brain with full tool access
- **Notifications**: Local push notifications on task completion
- **Persistence**: Scheduled tasks stored and survive app restarts
- **Social Post Auto-Publish**: Automatically publishes due social media posts (status `scheduled` with `scheduledAt ≤ now`) synchronously with brain-prompt task checking

## 🖥 Desktop File System Access

Chromium-only: GIA can read/write to a user-selected project folder:

- **Folder Picker**: Click "Pick Project Folder" in settings to grant access
- **Tools**: `filesystem_desktop_read`, `filesystem_desktop_write`, `filesystem_desktop_list`
- **File System Access API**: Uses the native browser File System Access API
- **Scope**: Limited to the selected directory tree only

## 🧠 Brain Export/Import

Full backup and restore of GIA's knowledge:

- **Export**: Download a complete `.gia-brain.json` file containing all memories, skills, identity config
- **Import**: Restore from a previously exported file via Settings → Brain Export
- **Scope**: Includes memories (all tiers), user profile, custom instructions, pinned memories

## 📱 Circle-to-Search

Screen capture + region selection for AI analysis:

- **Trigger**: Keyboard shortcut `Ctrl+Shift+C` or via command palette
- **Capture**: Takes a screenshot using native Capacitor plugin or browser `getDisplayMedia`
- **Crop**: Interactive region selection overlay with drag handles
- **Analysis**: Cropped image sent to GIA's vision-capable model for analysis
- **Fallback**: Multiple capture strategies (native, html2canvas, screen capture API)

## 🔗 Deep Link Support

- **`gia://` protocol**: Handles pasted `gia://` URIs as deep links
- **`web+gia://` protocol**: Detected from URL query parameters (`?url=web+gia://...`)
- **PWA Share Target**: Receives content shared from other apps via PWA API
- **Clipboard Monitor**: Detects copied text and shows "Ask GIA" toast

## 🔄 Clarification System

GIA can ask clarifying questions when input is ambiguous:

- **Single question per turn**: Guard against clarification loops
- **Structured options**: Multiple choice answers with tap-to-respond
- **Bottom sheet UI**: Slide-up panel with question and option buttons
- **Session-aware**: Linked to active session and specific assistant message

## 🔧 Protocol System (Tool Approval)

Every tool execution follows an approval workflow:

1. **Proposed**: GIA requests to execute a tool with specific arguments
2. **Confirmed/Modified**: User approves, rejects, or modifies arguments
3. **Executing**: Tool runs with live status indicator
4. **Completed/Failed**: Result displayed with observation note

Low-risk tools (web_search, read_url, environment_info, show_map, file_read, clarification) are auto-approved. High-risk tools (terminal_run, filesystem_write, etc.) require explicit user confirmation.

## 🌐 API Gateway

GIA includes a built-in API gateway for proxying, routing, and monitoring HTTP requests:

- **Route Management**: Create named routes with configurable method, path, target URL, rate limiting, and cache TTL
- **Proxy**: Forward requests through the gateway with automatic logging and monitoring
- **Logging**: Complete request/response log with status codes, duration, and error tracking
- **Stats**: Per-route call counts, success rates, average duration, method breakdown
- **Transform**: JSON and GraphQL body transformation support

Tools: `gateway_add_route`, `gateway_list`, `gateway_call`, `gateway_proxy`, `gateway_remove_route`, `gateway_toggle`, `gateway_stats`, `gateway_logs`

## 🔌 Connector System

Pre-configured API connectors with one-command setup and key management:

| Connector | Service | Type |
|-----------|---------|------|
| OpenWeatherMap | Weather data | API |
| NewsAPI | News headlines | API |
| GitHub API | Repos & user data | API |
| SERP API | Search results | API |
| SendGrid | Email delivery | Messaging |
| Supabase | PostgreSQL + realtime | Database |
| Firebase | Google Firebase backend | Cloud |
| AWS S3 | Cloud storage | Storage |
| Twilio | SMS & communication | Messaging |
| Notion API | Workspaces & databases | API |
| Telegram Bot | Bot messaging | Messaging |

Tools: `connector_list`, `connector_configure`, `connector_call`, `connector_test`, `connector_raw`, `connector_remove`

## 📱 Social Media Manager

Full social media management from within GIA — post, schedule, and analyze across 7 platforms:

- **Platforms**: X (Twitter), Instagram, Facebook, LinkedIn, TikTok, Telegram, WhatsApp
- **OAuth Login**: Browser-based OAuth flow for authenticated API access (X, Instagram, FB, LinkedIn, TikTok)
- **Manual Connect**: Link accounts with API tokens for real posting capability
- **Post Lifecycle**: Create drafts, schedule for later, publish, delete
- **Analytics**: Per-platform follower counts, engagement rates, impressions
- **Scheduling**: Unix timestamp-based scheduling for future posts

Tools: `social_list_platforms`, `social_connect`, `social_disconnect`, `social_oauth`, `social_create_post`, `social_publish`, `social_schedule`, `social_list_posts`, `social_delete_post`, `social_analytics`

## ✉️ Telegram Channel Integration

Dedicated Telegram channel management via Bot API:

- **Setup**: Configure bot token and channel ID (from @BotFather)
- **Posting**: Send formatted text (HTML/Markdown) and photos
- **Channel Info**: Fetch title, description, member count
- **Stats**: Member count, admin count
- **Status**: Check connection health at any time

Tools: `telegram_setup`, `telegram_channel_info`, `telegram_post`, `telegram_post_photo`, `telegram_stats`, `telegram_status`, `telegram_disconnect`

## 🔁 JSON Retry System

Unified retry utility for LLM JSON parsing failures across Analyst, Planner, and Exam modules:

- **Exponential backoff**: 1s → 3s → 6s → 10s delays (4 max retries)
- **Network awareness**: Detects `navigator.onLine` offline state — waits up to 15s for reconnection before failing with a clear network error
- **Empty response detection**: Fails fast on empty/whitespace-only responses
- **OutputValidator integration**: Auto-repairs malformed JSON before retry
- **Module-aware**: Logs with module prefix for debugging
- **Provider-switch hints**: Error messages suggest switching providers when appropriate

Used by: `AnalystModule`, `PlannerModule`, `ExamModule` via `src/utils/generateWithRetry.ts`

### Module Resilience

| Module | Offline/Cache Behavior |
|--------|----------------------|
| **Exam** | Questions saved to localStorage, restored on revisit. Hardcoded fallback question bank (Mathematics, English, Science) when AI unavailable. Yellow banner indicates cached/fallback questions. `beforeunload` protection during active quizzes. |
| **Planner** | Plans saved to localStorage. Scheduled task timers restored on mount; overdue tasks auto-fire. Fallback 7-step plan generated when offline. |
| **Analyst** | Last analysis saved to localStorage, restored on mount. Fallback sample data when AI fails. |

## 🩺 Provider Health Monitoring

Real-time per-model provider health tracking with degradation detection:

- **Per-model tracking**: Health stats keyed by `(providerId, modelId)` pair
- **Success Rate**: Running success/failure ratio for the last 100 calls
- **Latency Tracking**: Average response time per provider+model combination
- **Status Classification**: `healthy` (≥80% success), `degraded` (≥50%), `down` (<50%)
- **Consecutive Failure Detection**: Flags providers with rapid consecutive failures
- **Engine Room Integration**: `status` command shows live latency + error counts

## 🛡️ Security & Enterprise Hardening

GIA is architected for **zero-trust, no-backend security**. Every protection is implemented client-side with no external dependencies:

### No Attack Surface
- **No HTTP server** — GIA does not listen on any port. No remote control surface exists.
- **No WebSocket server** — no persistent inbound connections.
- **No telemetry** — zero outbound connections beyond user-configured APIs.
- **No backend** — there is no cloud service to compromise.

### API Key Protection
- API keys stored in **IndexedDB** (sandboxed per origin, not accessible to other apps).
- Optional **PIN lock** with SHA-256 hashing via Web Crypto API.
- Keys never appear in logs, URL parameters, or error messages.
- All provider communication is direct HTTPS (no proxy/middleman).

### Android WebView Hardening
- `android:usesCleartextTraffic="false"` recommended for production builds.
- JavaScript interface exposure is **zero** — no `@JavascriptInterface` bridges.
- File access restricted to app sandbox.
- `FOREGROUND_SERVICE_MICROPHONE` declared explicitly (Android 14+).

### Wake Word Security
- **Porcupine runs fully on-device** — no audio data ever leaves the phone.
- No network permission required for wake word detection.
- Audio capture stops when the service is stopped (no persistent recording).

### Input & Tool Security
- All tool inputs validated via Zod schemas before execution.
- Code execution is sandboxed via **Piston API** (not on-device).
- File operations restricted to app-scoped directories on Android.
- SQL injection, path traversal, and command injection guards on all file/code tools.
- No `eval()` or dynamic code execution in the GIA codebase.

### Network Security
- All outbound traffic is **HTTPS only** (no HTTP fallback).
- Content Security Policy enforced via `<meta>` tag:
  - No `unsafe-inline` for scripts (strict CSP).
  - CDN resources pinned to specific origins.
- `fetch` and `XMLHttpRequest` restricted to configured API endpoints.

### Build Hardening (Android)
| Measure | Status |
|---------|--------|
| ProGuard/R8 minification | ✅ Applied |
| `android:exported="false"` on activities | ✅ (except launcher) |
| `allowBackup="false"` | ✅ Recommended |
| `networkSecurityConfig` | ✅ XML-based (allows only specific API domains) |
| Certificate Pinning | 🔜 Planned (OkHttp pinning for provider APIs) |

### Recommended Production Config

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <!-- Allow specific API domains only -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.anthropic.com</domain>
        <domain includeSubdomains="true">api.openai.com</domain>
        <domain includeSubdomains="true">generativelanguage.googleapis.com</domain>
        <domain includeSubdomains="true">api.groq.com</domain>
        <domain includeSubdomains="true">openrouter.ai</domain>
        <domain includeSubdomains="true">duckduckgo.com</domain>
        <domain includeSubdomains="true">piston.api</domain>
    </domain-config>
</network-security-config>
```

---

## 🛠️ Development

```bash
git clone https://github.com/alpha-1-design/gia-app.git
cd gia-app
npm install
npm run dev          # dev server
npm run build        # production build
npx cap sync android # sync for Android
```

---

## 📜 Privacy

No telemetry, no analytics, no data collection. API keys stored on-device (IndexedDB). See [`src/privacy.md`](src/privacy.md).

## ⚖️ License

Apache 2.0 · © 2026 Samuel Mensah · Alpha-1 Studio, Ghana
