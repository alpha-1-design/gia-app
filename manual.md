# GIA v2.3.1.0 — User Manual

GIA (Generative Interface Agent) is a private, on-device AI workspace for students, developers, and creators.

## 🧠 What's New in v2.3.1.0

| Feature | Description |
|---------|-------------|
| **Agentic Loop** | Full autonomous tool execution — web search, code run, file ops, image gen, ZIP bundling, sub-agent delegation |
| **Live Thinking Panel** | Real-time streaming of AI reasoning, collapsible per message |
| **Knowledge Panel** | Manage memories (search, filter, pin, add, delete, import/export facts) + custom instructions editor |
| **Memory Pinning** | Pin important memories so they're always injected into system prompt |
| **Custom Instructions** | Write rules GIA follows in every conversation (e.g. "always reply in Twi") |
| **Conversation Search** | Search across all session titles and message content with match count |
| **Rich Markdown** | Mermaid diagrams, KaTeX math, SVG blocks, task lists, collapsible sections, footnotes, definition lists, rich tables with copy, inline code click-to-copy |
| **Interactive Visual Blocks** | Charts, maps, mind maps, timelines, data tables, galleries, terminal output, metric widgets, document outlines |
| **Image Generation** | DALL-E 3 or OpenRouter image models — images render inline in chat |
| **Search Citations** | Source numbered badges `[1]` with clickable links in search results |
| **File Preview** | PDF text extraction, code preview with syntax coloring, file info cards |
| **Extended Thinking** | Configurable reasoning budget for o1/o3/o4-mini and Gemini models |
| **Clarification Loop Guard** | GIA asks at most one clarification question per turn to avoid loops |
| **Streaming Race Guard** | Multiple drain handlers on SSE streams prevented from racing |
| **Empty Response Guard** | GIA retries if it generates nothing (up to 2 attempts) |
| **PIN Lock** | SHA-256 hashed PIN via Web Crypto API |
| **Error Boundary** | Root-level crash recovery so GIA never shows a white screen |
| **Floating Stop Button** | Always-visible stop during generation |
| **No-API-Key Banner** | Clickable banner redirects to Settings |
| **Blurred Input** | Transparent/glass input area with backdrop blur |
| **Phase Badges** | Thinking… → Generating… → Done (with model name) |
| **Streaming Cursor** | Blinking `▋` cursor during token delivery |
| **Voice (enhanced)** | Native wake word engine (Porcupine), background detection, transcript polishing, TTS |
| **Message Context Menu** | Right-click or long-press on messages for Copy/Edit/Retry/Continue/Fork/Delete |
| **Conversation Branching** | Tree-based branching from any message — rename, switch, delete branches |
| **Session Forking** | Fork entire session at any message into a new independent session |
| **Autonomous Goals** | Goal creation → auto-decomposition → step execution → self-reflection |
| **Proactive Engine** | Background goal execution during idle time |
| **Circle-to-Search** | Screen capture with region crop for AI vision analysis |
| **Scheduled Tasks** | Schedule hourly/daily/weekly AI prompts |
| **Brain Export/Import** | Full memory backup and restore from JSON |
| **Smart Provider Fallback** | Automatic provider failover based on real-time latency/error tracking |
| **Input Guardrails** | Blocks prompt injection attempts and dangerous commands |
| **Output Validation** | Auto-repairs malformed JSON, missing fences, repeated text |
| **Response Caching** | Cache identical requests to reduce API costs |
| **Desktop File Access** | Read/write/list files in a selected project folder (Chrome) |
| **PWA Share Target** | Receive content shared from other apps |
| **Deep Link Support** | `gia://` and `web+gia://` protocol handling |
| **Clipboard Monitor** | Detects copied text with "Ask GIA" button |

## 🛠 Core Modules

| Module | Purpose |
|--------|---------|
| **Chat** | Primary workspace with full agentic tools and visualizations |
| **Analyst** | Deep research + data analysis with persistent memory |
| **Writer** | Professional drafting and creative writing |
| **Planner** | Task management and goal-oriented execution |
| **Exam** | Educational assessment, WASSCE-tuned testing |
| **Settings** | API keys (Engine Room), skills, MCP, plugins, theme, export data |
| **Autonomy** | Autonomous goal management — create, track, and manage AI-executed goals |

## 🤖 Tools Available to GIA

Enable **Hands-off Mode** in Settings for fully autonomous operation:

| Tool | Purpose |
|------|---------|
| `web_search` | Real-time DuckDuckGo search with source citations |
| `read_url` | Extract clean markdown from any web page |
| `browser_navigate` | Full JS-rendered page navigation (iframe sandbox) |
| `page_info` | Lightweight page metadata without full fetch |
| `terminal_run` | Execute shell commands in proot+Alpine Linux environment (Android) |
| `code_execute` | Run code via Piston API (Python, JS, C++, more) |
| `http_request` | Make arbitrary HTTP requests (GET, POST, PUT, DELETE) |
| `web_scrape` | Fetch and extract readable content from any URL |
| `data_analysis` | Analyze structured data (CSV, JSON, TSV) with stats and samples |
| `math` | Evaluate mathematical expressions safely |
| `encode_decode` | Base64, URL, and JSON encode/decode |
| `generate_qr` | Generate QR code images from text or URLs |
| `classify_text` | Classify text into categories using on-device local AI |
| `list_available_apis` | List free public APIs available for use |
| `screenshot` | Capture screenshot of any public webpage |
| `local_search` | Search GIA's internal knowledge — notes and memories |
| `send_whatsapp` | Send WhatsApp message with pre-filled text |
| `send_email` | Compose email via device email client |
| `send_sms` | Send SMS directly (Android) or via SMS app |
| `make_phone_call` | Initiate phone call via dialer |
| `share` | Share content to any app via native share sheet |
| `clipboard` | Read from or write to system clipboard |
| `vibrate` | Trigger device vibration/haptic feedback |
| `filesystem_read` | Read files from device storage |
| `filesystem_write` | Write files to device storage |
| `list_files` | List directory contents (mobile) |
| `filesystem_desktop_read/write/list` | Project folder access (Chrome desktop only) |
| `zip_project` | Bundle project files into .zip |
| `image_generation` | Generate and inline images via DALL-E 3 |
| `sub_agent_call` | Delegate to another AI provider/model for sub-tasks |
| `request_clarification` | Ask user a single clarifying question |
| `switch_module` | Navigate to any module (chat/exam/analyst/writer/planner/settings) |
| `toggle_feature` | Enable/disable web_search, thinking, hands_off |
| `show_notification` | Display a global toast notification |
| `get_environment_info` | Full introspection of GIA identity, capabilities, environment |
| `get_user_location` | GPS location (mobile + browser) |
| `search_places` | OpenStreetMap place search |
| `show_map` | Render interactive OpenStreetMap with markers |
| `wikipedia` | Wikipedia article summaries |
| `weather` | Current weather for any city |
| `define` | Dictionary definitions with examples |
| `github` | Fetch GitHub user/repo/file data |
| `summarize_conversation` | Compress conversation history |
| `forget_memory` | Delete specific memories |
| `export_brain` | Download full brain backup as JSON |
| `import_brain` | Restore brain from backup |
| `task_create/read/update/delete/move` | Full task management |
| `note_create/read/update/delete` | Sticky notes management |
| `create_goal` | Create autonomous goals |
| `list_goals` | List all autonomous goals |
| `goal_progress` | Get goal progress report |
| `pause_goal` | Pause/resume/cancel a goal |
| `set_autonomy_config` | Configure autonomy settings |

---

## 🐚 Terminal Environment

GIA includes a native **proot + Alpine Linux** terminal environment on Android:

- **Full shell access**: Execute any shell command (bash, sh, etc.) inside a lightweight Alpine Linux container
- **Persistence**: Sessions can be kept alive across multiple tool calls — use `persist: true` to maintain state
- **File system**: Access container file system with disk usage info available
- **Lifecycle**: Sessions auto-terminate after command completion unless persisted
- **Contrast with Piston**: `code_execute` runs code snippets on a remote Piston API server. `terminal_run` gives you a full Linux shell on your device with proot.

## 🧪 Local AI (On-Device)

GIA can run AI models directly in your browser with no API call needed:

- **Text Classification**: Categorize text into user-defined labels with confidence scores
- **Summarization**: Compress long texts locally
- **Translation**: Translate between languages without any cloud service
- **Embeddings**: Generate text embeddings for semantic search
- **QA**: Answer questions based on provided context
- **On-Device Vision**: Caption images, extract text (OCR), detect objects, and classify scenes — routes between local models and provider APIs automatically

These run via HuggingFace Transformers (WASM) or similar browser-based inference engines. No data leaves your device.

## 🐍 Local Python Execution (Pyodide)

In addition to the remote Piston API, GIA can run Python code **directly in your browser** via Pyodide WASM:

- **Full Python 3.11 stdlib**: `math`, `json`, `re`, `collections`, `random`, `datetime`, etc.
- **Scientific packages**: `numpy`, `pandas`, `matplotlib` (loaded on demand)
- **No server needed**: Everything runs in-browser — zero latency, works offline
- **Use case**: Quick calculations, data transformations, visualizations without API calls

Trigger via the `code_execute` tool — GIA automatically tries local Pyodide when available.

## 📝 Notes Panel

GIA includes a full sticky notes system:

- **Create notes**: Rich text with custom colors
- **Organize**: Tag and pin notes for quick access
- **Search**: Full-text search across all notes
- **AI-managed**: GIA can create, read, update, and delete notes via tool calls (`note_create`, `note_read`, `note_update`, `note_delete`)
- **Access**: Open the Notes Panel from the chat toolbar or via command palette

## 📱 Native Device Integration

GIA can interact with your device directly:

| Action | Tool | Description |
|--------|------|-------------|
| **Make calls** | `make_phone_call` | Opens dialer with number pre-filled |
| **Send SMS** | `send_sms` | Direct SMS on Android (with permission), falls back to SMS app |
| **WhatsApp** | `send_whatsapp` | Opens WhatsApp with pre-filled message |
| **Email** | `send_email` | Opens email client with recipient, subject, and body |
| **Share** | `share` | Native share sheet to any app |
| **Clipboard** | `clipboard` | Read from or write to system clipboard |
| **Vibrate** | `vibrate` | Haptic feedback (light/medium/heavy pulse) |

## 🔊 Voice Overlay

When voice input is active, GIA shows a full-screen **animated voice overlay**:

- **Waveform visualization**: Live audio-reactive bars
- **Ripple rings**: Expanding concentric rings around the microphone icon
- **State indicators**: Visual feedback for listening → processing → done states
- **Triggered by**: Wake word detection or push-to-talk

## 🔄 Offline Queue

GIA handles network interruptions gracefully:

- **Automatic queuing**: Tool calls are queued locally when the network is unavailable
- **FIFO replay**: Queued calls replay in order when connectivity is restored
- **Retry logic**: Each queued call has configurable max retries with error tracking
- **Persistence**: Queue survives app restarts (stored in localStorage)
- **Transparent**: GIA continues working — you won't notice the interruption

---

## 🎙 Voice Control

### Wake Word System

GIA uses **Porcupine** by Picovoice — a deep neural network wake word engine that runs **100% on-device**. No audio data ever leaves your phone.

#### How it works

1. **Porcupine DNN** continuously monitors the microphone audio stream (16kHz, on-device)
2. When the wake word is detected, Porcupine fires a signal with millisecond-level latency
3. GIA's **Android Foreground Service** receives the signal and notifies the app
4. GIA immediately starts a **speech-to-text session** to capture your command
5. The transcribed text is **polished** (grammar, punctuation, noise rejection) via AI
6. The polished text appears in the chat input field and GIA processes your request

#### What happens when you say "Hey GIA"

```
You say "Hey GIA, what's the weather?"
    │
    ▼
[Porcupine] on-device DNN detects "Hey GIA" (~200ms)
    │
    ├──→ Audio beep (880 Hz, 150ms)
    ├──→ Notification: "Wake word detected"
    ├──→ Speech-to-text starts (captures "what's the weather?")
    ├──→ AI polishes transcript ("What's the weather?")
    └──→ Text appears in chat input → GIA processes it
```

#### Key capabilities

| Feature | Behavior |
|---------|----------|
| **Background detection** | Works when app is minimized (foreground service keeps listening) |
| **Screen off** | Works with screen locked (service runs independently of Activity) |
| **Auto-restart** | Automatically resumes after device reboot |
| **Sensitivity** | Adjustable (0–1) in Settings — lower = fewer false positives, higher = catches more |
| **Stay Listening** | On: GIA stays in wake word mode after each command. Off: one-shot, returns to idle |
| **Auto-Start** | Automatically starts listening when the app opens |
| **Privacy** | 100% on-device wake word detection — no cloud, no audio upload |

#### Settings

Go to **Settings → Voice Control**:

- **Wake Word** — the phrase that activates listening (default: "hey gia")
- **Recognition Language** — speech-to-text language (e.g., en-US, fr-FR)
- **Background Wake Word** — toggle the native Porcupine engine on/off
- **Sensitivity** — how sensitive the wake word detection is (0.0–1.0)
- **Auto-Start** — automatically start listening when the app opens
- **Stay Listening** — keep listening after each wake word (vs. one-shot)
- **Voice Response (TTS)** — GIA reads responses out loud

#### About "JARVIS" in the code

Porcupine ships with free built-in keywords (`HEY_GOOGLE`, `COMPUTER`, `ALEXA`, `JARVIS`) for testing without training a custom model. The default fallback uses `JARVIS` (a built-in Porcupine keyword). To use "Hey GIA" as a native keyword:

1. Sign up at [Picovoice Console](https://console.picovoice.ai/) (free tier available)
2. Train a custom "Hey GIA" wake word model
3. Download the `.ppn` file
4. Place it in `android/app/src/main/assets/`
5. Get your free **AccessKey** from the Picovoice Console dashboard
6. Pass it to GIA (hardcoded or via the plugin config)

The JS-side setting ("hey gia") is used by the browser-based fallback (regex on transcript). The native Porcupine keyword is configured separately.

---

### Push-to-Talk

Tap the **mic icon** in the chat toolbar to start speaking. Tap again to stop. GIA polishes the transcript automatically.

### Voice Response (TTS)

When enabled in Settings, GIA reads her responses out loud using the device's text-to-speech engine.

---

## ⚡ Neural Command Palette

Tap `Cmd+K` (or `/` in Chat) to open the command palette:
- Switch between **Skills** (Developer Mode, General Assistant, etc.)
- Quick actions: New Session, Open Settings, Toggle Protocols
- Keyboard shortcuts displayed inline

## ⚙️ Skills

1. Go to **Settings → Neural Skills**
2. Tap **+** to create a custom assistant
3. Define system prompt + allowed tools
4. Skills appear in `/` command palette

Pre-installed skills:
- **General Assistant** — Balanced help for general tasks
- **Developer Mode** — Expert software engineering
- **Research Analyst** — Deep web research & synthesis
- **Creative Architect** — Copywriting & storytelling
- **Academic Tutor** — WASSCE/BECE exam prep
- **Security Expert** — Code vulnerability audits

## 🧠 Knowledge Panel

Tap the brain icon in the chat toolbar to open the Knowledge Panel:

### Memories Tab
- Browse all auto-extracted and manual memories
- Search/filter memories by content
- Pin/unpin memories (pinned ones always in system prompt)
- Add a fact manually
- Delete unwanted memories
- Import memories from JSON
- Export memories as JSON

### Custom Instructions Tab
- Write persistent rules GIA follows in every conversation
- Examples: "Always answer in Twi", "Never mention competitors", "Use British spelling"

## 🧩 Visual Blocks

GIA can render interactive data visualizations inside chat messages. These are generated by GIA using ` ```visual ` code blocks:

- **Charts** — Bar, line, pie, area charts with interactive tooltips
- **Tables** — Sortable data tables with copy support
- **Mind Maps** — Tree diagram visualizations
- **Timelines** — Chronological event sequences
- **Code Diffs** — Side-by-side code comparison
- **Image Galleries** — Grid image displays
- **Terminal Output** — ANSI-colored terminal simulation
- **Metric Widgets** — KPI cards with labels and values
- **Document Outlines** — Tree/table-of-contents views
- **Maps** — Interactive Leaflet/OpenStreetMap with markers and routes
- **Audio Waveforms** — Audio visualization

GIA will use these automatically when presenting structured data.

## 🔄 Conversation Branching

Every conversation supports tree-based branching:

- **Create a branch**: Right-click/long-press any message → **Fork** to create a named branch
- **Switch branches**: Use the branch indicator to switch between active branches
- **Rename branches**: Give meaningful names to track different exploration paths
- **Delete branches**: Remove unwanted branches without affecting others
- **Session forking**: Fork an entire session at any message into a new independent session

Use branching to explore alternative responses without losing context.

## 🎯 Autonomous Goals

GIA can work autonomously on complex goals. Access via the **Autonomy** module:

1. **Create a Goal**: Set a title, description, and priority (Low/Medium/High/Critical)
2. **Auto-Decomposition**: GIA breaks the goal into actionable steps
3. **Execution**: Each step is executed with full tool access and LLM reasoning
4. **Reflection**: After each step, GIA evaluates success and learns lessons
5. **Progress Tracking**: Visual progress bar, step status indicators, reflection history

Enable **Autonomy Mode** (toggle in Autonomy module) to allow GIA to work on goals during idle time. Adjust **Proactiveness** slider to control how aggressively GIA pursues goals.

## 🔍 Circle-to-Search

Select any region of your screen for AI analysis:

1. Press `Ctrl+Shift+C` or activate via command palette
2. GIA captures the current screen
3. Drag to select a region of interest
4. The cropped region is sent to GIA's vision model for analysis

## ⏰ Scheduled Tasks

Schedule recurring AI operations:

1. Create a task via GIA (e.g., "summarize the news every morning")
2. Choose interval: Hourly, Daily, or Weekly
3. GIA executes the prompt on schedule and notifies you with results

Configure and manage scheduled tasks in Settings.

## 📦 Brain Export/Import

Back up and restore all of GIA's knowledge:

- **Export**: Settings → Brain Export → Download — saves all memories, skills, identity as `.gia-brain.json`
- **Import**: Settings → Brain Export → Upload — restores from a previous backup

## 🖥 Desktop File Access (Chrome)

GIA can access files in a project folder on desktop browsers:

1. Click **"Pick Project Folder"** in Settings or the tools panel
2. Select a folder in the browser's file picker
3. GIA can now read, write, and list files in that folder using dedicated tools

## 🌐 MCP (Model Context Protocol)

Connect GIA to external MCP servers for extended tool capabilities:

- **Configure**: Settings → MCP — add SSE or stdio servers
- **Auto-connect**: Servers marked as auto-connect are linked on app start
- **Auto-discovery**: Detects GIA Stdio Bridge at `localhost:3080`
- **Tools**: MCP tools appear in GIA's tool set with an `mcp__` prefix

## 🔧 Protocol System (Tool Approval)

Every tool execution follows a transparent approval workflow:

- **Low-risk tools** (web_search, read_url, show_map, file_read, clarification): Auto-approved
- **High-risk tools** (terminal_run, filesystem_write, ...): Require explicit user confirmation
- **Protocol Panel**: `Ctrl+Shift+O` or tap the ⚡ button to see pending/active/completed tool executions
- **Modify**: You can edit tool arguments before approving
- **Reject**: Decline tool execution — GIA will try an alternative approach

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Toggle Command Palette |
| `Cmd+N` | New Session |
| `Cmd+Shift+S` | Open Settings |
| `Cmd+Shift+O` | Toggle Protocol Panel |
| `Cmd+Shift+C` | Circle-to-Search |
| `Escape` | Close Command Palette |
| Right-click / Long-press | Message context menu (Copy/Edit/Retry/Fork/Delete) |

## 🖥 Engine Room

Configure provider API keys in Settings → Engine Room:

- **Anthropic** — Claude models with extended thinking
- **OpenAI** — GPT-4o, o1, o3, o4-mini (with reasoning_effort)
- **Gemini** — Google AI Flash/Pro (with vision)
- **Groq** — Ultra-fast inference
- **OpenRouter** — 100+ models (DeepSeek, Llama, Gemma, etc.)
- **OpenCode** — Specialized coding provider
- **Ollama (Local)** — Run models locally via Ollama
- **LM Studio (Local)** — Run models locally via LM Studio

GIA automatically:
- **Falls back** to an alternative provider if the active one fails
- **Switches models** based on task requirements (e.g., vision for images)
- **Monitors latency/errors** — chooses the healthiest provider
- **Caches responses** for identical requests to save API costs

---

---

## 🔒 Security

See [`SECURITY.md`](SECURITY.md) for full details. Key points:

- **No backend** — there is no cloud service to hack
- **No remote control** — GIA doesn't listen on any port
- **No telemetry** — zero data collection
- **Wake word is on-device** — audio never leaves your phone
- **API keys are local** — stored in IndexedDB, never shared
- **Input validation** — every tool input is validated via Zod schemas
- **HTTPS only** — all outbound traffic encrypted

---

*Built by Samuel Mensah · Alpha-1 Studio, Ghana*
*GIA is private. Your keys and data stay on your device.*
*Licensed under Apache 2.0 · © 2026 Samuel Mensah*
