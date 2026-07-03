# GIA v2.3.1.2 — User Manual

GIA (Generative Interface Agent) is a private, on-device AI workspace for students, developers, and creators.

## 🧠 What's New in v2.3.1.2

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
| **Device Health Monitoring** | Storage (>75% warn, >90% critical), battery (<30% low, <15% critical), memory pressure alerts — proactive assistant checks |
| **Directions & Maps** | Turn-by-turn OSRM routing with interactive map rendering via `get_directions` + `show_map` |
| **Build & Install Tools** | `build_project` scaffolds, builds, and packages; `install_skill` adds new skills from URL |
| **Memory Tools** | `save_memory` and `forget_memory` with category filtering |
| **Module Resilience** | Exam/Planner/Analyst modules auto-save to localStorage, use cached/fallback data when offline |
| **Network-Aware Retry** | `generateWithRetry` detects offline state, waits for reconnection, gives provider-switch hints |
| **Scheduled Post Auto-Publish** | Due social media posts publish automatically |
| **Hanging Step Detection** | Autonomous steps stuck >5min auto-fail — engine moves to next step |
| **CI Signed APKs** | Release keystore generated during CI — signed release APK ready to sideload |
| **GIA Identity** | Configurable name, personality, tone, focus areas, and proactiveness — shapes every response |
| **On-Device Whisper** | Download local Whisper ONNX model for fully offline speech-to-text |
| **On-Device Vision Models** | Manage captioning, OCR, detection, classification models with confidence threshold and provider fallback |
| **Long-Running Mode** | Screen wake lock + background heartbeat to prevent suspension during long tasks |
| **Auto-Unload Idle Models** | Frees memory by unloading Whisper/Vision/LLM after 10min inactivity |
| **Calendar Integration** | Google Calendar CRUD via OAuth — list, create, update, delete events |
| **Email Integration** | Gmail read/send via OAuth — full inbox management |
| **Bible & Devotion Tools** | Verse of the day, Bible search, daily devotionals, morning briefing |
| **Messaging Platforms** | WhatsApp and Telegram bot messaging with mention-only mode |
| **Gateway Daemon** | 24/7 background listener for Telegram and other gateway operations |
| **Notifications System** | Send, schedule, cancel, and list native push notifications with permission management |
| **Geolocation Tools** | Current position, continuous watching, permission checks — 5 granular tools |
| **Haptic Patterns** | Impact (light/medium/heavy), notification (success/warning/error), and custom vibration — 3 separate tools |
| **Granular Clipboard** | Separate `clipboard_read` and `clipboard_write` tools alongside combined `clipboard` |
| **Granular Share** | `share_content` tool for native share sheet |
| **Device Plugins** | Battery level, device ID, locale, and plugin info tools |
| **RAG Document Listing** | `rag_list_docs` to list all indexed RAG documents |
| **File Editing** | `edit_document` and `download_file` tools for modifying generated files |
| **Sandbox Package Management** | `sandbox_install`, `sandbox_clone`, `sandbox_fs` for package install, git clone, filesystem ops |
| **Full Autonomy Mode** | Executes all tools without approval — per-tool auto-approval configuration |
| **Custom Skill Editor** | Create skills with custom name, system prompt, and tool assignment toggles |
| **Plugin Management UI** | Install plugins from URL or file upload with enable/disable controls |
| **Brain Cloud Backup** | Sync memory to WebDAV or S3-compatible endpoints |
| **Developer Settings** | Token usage display, log level, HuggingFace token, network monitor, cache controls |

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
| **Agents** | Custom AI personas with private knowledge files, per-agent tools, and self-contained chat |

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
| `device_info` | Device info: OS, battery, network, display, locale |
| `device_health` | Check storage, battery, memory — call proactively to monitor risks |
| `screen_brightness` | Get/set screen brightness (Android native) |
| `get_contacts` | Search device contacts |
| `open_url` | Open any URL in browser |
| `set_alarm` | Set Android alarm via AlarmManager |
| `get_directions` | Turn-by-turn directions (OSRM) with interactive map |
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
| `note_create/read/update/delete/toggle_pin` | Sticky notes management |
| `create_goal` | Create autonomous goals |
| `list_goals` | List all autonomous goals |
| `goal_progress` | Get goal progress report |
| `pause_goal` | Pause/resume/cancel a goal |
| `set_autonomy_config` | Configure autonomy settings |
| `save_memory` | Save a fact, preference, or detail to memory |
| `forget_memory` | Delete memories (by key, category, or all) |
| `build_project` | Scaffold, build, and package code projects into downloadable ZIP |
| `install_skill` | Install a new skill from URL or built-in registry |
| `telegram_setup` | Connect Telegram bot + channel |
| `telegram_status` | Check Telegram config status |
| `telegram_channel_info` | Get channel info (title, members, description) |
| `telegram_post` | Post text to Telegram channel |
| `telegram_post_photo` | Post photo to Telegram channel with caption |
| `telegram_stats` | Channel member + admin count |
| `telegram_disconnect` | Remove Telegram config |
| `gateway_add_route` | Add gateway route |
| `gateway_list` | List all gateway routes |
| `gateway_call` | Call API through gateway route |
| `gateway_proxy` | Direct proxy HTTP request |
| `gateway_remove_route` | Delete a gateway route |
| `gateway_toggle` | Enable/disable a route |
| `gateway_stats` | Calls, success rate, avg duration |
| `gateway_logs` | Recent call history per route |
| `sandbox_exec` | Execute commands in Alpine sandbox (Docker/proot) — install packages, run scripts |
| `sandbox_read_file` | Read file from sandbox file system |
| `sandbox_write_file` | Write file to sandbox file system |
| `sandbox_download_url` | Get download URL for a sandbox file |
| `sandbox_status` | Check sandbox health and resource usage |
| `camera_capture` | Take a photo with the device camera |
| `generate_file` | Generate PDF, DOCX, PPTX, or ZIP files from content |
| `edit_document` | Edit an existing generated document |
| `download_file` | Download a generated file |
| `document_read` | Extract text content from PDF, DOCX, PPTX files |
| `rag_search` | Semantic vector search across indexed documents |
| `rag_list_docs` | List all indexed RAG documents |
| `terminal_status` | Check proot terminal session status |
| `terminal_kill` | Kill a proot terminal session |
| `note_toggle_pin` | Pin or unpin a sticky note |
| `clipboard_read` | Read from system clipboard |
| `clipboard_write` | Write to system clipboard |
| `haptic_impact` | Trigger impact haptic feedback (light/medium/heavy) |
| `haptic_notification` | Trigger notification haptic (success/warning/error) |
| `haptic_vibrate` | Trigger custom vibration pattern |
| `share_content` | Share content via native share sheet |
| `geolocation_get_current_position` | Get current GPS position with accuracy/altitude/speed |
| `geolocation_watch_position` | Continuously watch position changes |
| `geolocation_clear_watch` | Stop position watching |
| `geolocation_check_permissions` | Check location permission status |
| `geolocation_request_permissions` | Request location permissions |
| `notifications_send` | Send a local push notification |
| `notifications_schedule` | Schedule a future notification |
| `notifications_cancel` | Cancel a scheduled notification |
| `notifications_pending` | List all pending notifications |
| `notifications_check_permissions` | Check notification permission status |
| `notifications_request_permissions` | Request notification permissions |
| `device_plugin_info` | Get device plugin information |
| `device_plugin_battery` | Get battery level and charging status |
| `device_plugin_id` | Get unique device identifier |
| `device_plugin_locale` | Get device locale and language |
| `sandbox_install` | Install packages in Alpine sandbox via apk |
| `sandbox_clone` | Clone a git repository into sandbox |
| `sandbox_fs` | List files in sandbox filesystem |
| `connector_list` | List all configured API connectors |
| `connector_configure` | Configure an API connector with key |
| `connector_call` | Call an API connector |
| `connector_test` | Test an API connector connection |
| `connector_raw` | Make a raw request via connector |
| `connector_remove` | Remove an API connector |
| `social_list_platforms` | List connected social media platforms |
| `social_connect` | Connect a social media platform |
| `social_disconnect` | Disconnect a social platform |
| `social_oauth` | Start OAuth flow for a social platform |
| `social_create_post` | Create a social media post draft |
| `social_publish` | Publish a social media post immediately |
| `social_schedule` | Schedule a social media post |
| `social_list_posts` | List scheduled/published posts |
| `social_delete_post` | Delete a social media post |
| `social_analytics` | Get per-platform analytics (followers, engagement, impressions) |
| `email_connect` | Connect Gmail via OAuth |
| `email_disconnect` | Disconnect Gmail |
| `email_status` | Check email connection status |
| `email_send` | Send an email |
| `email_list` | List inbox messages |
| `email_read` | Read an email by ID |
| `email_search` | Search through emails |
| `calendar_connect` | Connect Google Calendar via OAuth |
| `calendar_disconnect` | Disconnect Google Calendar |
| `calendar_status` | Check calendar connection status |
| `calendar_list_events` | List calendar events |
| `calendar_create_event` | Create a calendar event |
| `calendar_update_event` | Update a calendar event |
| `calendar_delete_event` | Delete a calendar event |
| `messaging_status` | Check messaging platform status |
| `messaging_setup_telegram` | Set up Telegram messaging |
| `messaging_setup_whatsapp` | Set up WhatsApp messaging |
| `messaging_disconnect` | Disconnect a messaging platform |
| `messaging_send` | Send a message via configured platform |
| `messaging_set_mention_only` | Set mention-only mode for platform |
| `bible_verse` | Get verse of the day or search Bible by reference |
| `daily_devotion` | Fetch daily devotional content |
| `setup_morning_briefing` | Configure daily morning briefing |
| `set_reminder` | Set a personalized reminder |
| `play_music` | Play audio tracks |
| `gateway_daemon_start` | Start the background gateway daemon |
| `gateway_daemon_stop` | Stop the gateway daemon |
| `gateway_daemon_status` | Check gateway daemon status |
| `gateway_daemon_logs` | View gateway daemon logs |

---

## 🐚 Terminal Environment

GIA includes a native **proot + Alpine Linux** terminal environment on Android:

- **Full shell access**: Execute any shell command (bash, sh, etc.) inside a lightweight Alpine Linux container
- **Persistence**: Sessions can be kept alive across multiple tool calls — use `persist: true` to maintain state
- **File system**: Access container file system with disk usage info available
- **Lifecycle**: Sessions auto-terminate after command completion unless persisted
- **Contrast with Piston**: `code_execute` runs code snippets on a remote Piston API server. `terminal_run` gives you a full Linux shell on your device with proot.

## 🏖 Alpine Sandbox

GIA includes a full Linux sandbox environment for running commands, installing packages, and executing scripts:

- **Modes**: Docker (if available) or proot-based Alpine Linux
- **Persistence**: Sessions maintain state across multiple tool calls
- **Package management**: Install packages via `apk` (Alpine's package manager)
- **File system**: Read/write files in the sandbox workspace
- **Download**: Get download URLs for files generated in the sandbox
- **Use cases**: Run Python scripts, compile code, install tools, process data — all in an isolated environment

The sandbox replaces the need for remote code execution services — everything runs locally on your device.

## 📷 Camera Capture

GIA can take photos using your device's camera and analyze them with vision-capable AI models:

- **Capture**: Opens the native camera UI via Capacitor — take a photo or select from gallery
- **Vision analysis**: Captured images are sent to GIA's vision models (Claude, GPT-4o, Gemini, etc.) for description, analysis, OCR, or question answering
- **Privacy**: Images are processed through your configured AI provider — no third-party uploads

## 📄 File Generation

GIA can generate professional documents from markdown content:

| Format | Tool | Description |
|--------|------|-------------|
| **PDF** | `filegen` with format `pdf` | Renders markdown to PDF with formatting |
| **DOCX** | `filegen` with format `docx` | Produces editable Word documents |
| **PPTX** | `filegen` with format `pptx` | Generates slide decks with title/content slides |
| **ZIP** | `filegen` with format `zip` | Bundles specified files into a ZIP archive |

Generated files appear as downloadable links in chat with inline preview.

## 📖 Document Reader

GIA can extract and read content from existing documents:

| Format | Tool | Description |
|--------|------|-------------|
| **PDF** | `document_read` | Extracts text from PDF files |
| **DOCX** | `document_read` | Reads Word document content |
| **PPTX** | `document_read` | Extracts text from PowerPoint slides |

The extracted content appears in chat with format name, file path, and text size — GIA can then analyze, summarize, or respond based on the document contents.

## 🧪 Local AI (On-Device)

GIA can run AI models directly in your browser with no API call needed:

- **Text Classification**: Categorize text into user-defined labels with confidence scores
- **Summarization**: Compress long texts locally
- **Translation**: Translate between languages without any cloud service
- **Embeddings**: Generate text embeddings for semantic search
- **QA**: Answer questions based on provided context
- **On-Device Vision**: Caption images, extract text (OCR), detect objects, and classify scenes — routes between local models and provider APIs automatically

These run via HuggingFace Transformers (WASM) or similar browser-based inference engines. No data leaves your device.

## 🧠 On-Device Generative LLM

Beyond classifiers and embeddings, GIA can run **full generative LLMs locally** on your device:

- **Models**: Qwen2.5 (0.5B, 1.5B, 3B) downloaded through Settings → Local Models
- **Inference Engine**: HuggingFace Transformers WASM — runs entirely in-browser
- **Features**: Streaming text generation, abort support, progress tracking
- **Privacy**: 100% on-device — no API call, no data leaves your phone
- **Use Cases**: Chat, text generation, analysis — all offline

Download models directly through GIA: connect your HuggingFace token in Dev Settings, then tap any model to download.

---

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

## 🔄 Network-Aware Retry & Offline Handling

GIA handles network interruptions gracefully across all modules:

- **Automatic queuing**: Tool calls are queued locally when the network is unavailable
- **FIFO replay**: Queued calls replay in order when connectivity is restored
- **Retry logic**: Each queued call has configurable max retries with error tracking
- **Persistence**: Queue survives app restarts (stored in localStorage)
- **Transparent**: GIA continues working — you won't notice the interruption
- **Network-aware retry**: `generateWithRetry` detects offline state (`navigator.onLine`), waits up to 15s for reconnection, provides clear error messages with provider-switch suggestions

### Module Resilience

| Module | Behavior When Offline / AI Fails |
|--------|----------------------------------|
| **Exam** | Questions saved to localStorage — restored on revisit. Hardcoded fallback question bank (Mathematics, English, Science, 10 Qs each) when AI unavailable. Yellow banner indicates cached/offline questions. |
| **Planner** | Plans saved to localStorage across navigation. Scheduled task timers restored on mount; overdue tasks auto-fire. Fallback 7-step plan generated when offline. |
| **Analyst** | Last analysis saved to localStorage, restored on mount. Fallback sample data when AI fails. |

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
3. **Immediate Execution**: First step begins right away (no idle wait)
4. **Execution**: Each step is executed with full tool access and LLM reasoning
5. **Hanging Step Detection**: Steps stuck >5 minutes are auto-marked as failed — GIA moves on
6. **Reflection**: After each step, GIA evaluates success and learns lessons
7. **Progress Tracking**: Visual progress bar, step status indicators, reflection history

Enable **Autonomy Mode** (toggle in Autonomy module) to allow GIA to work on goals during idle time. Adjust **Proactiveness** slider to control how aggressively GIA pursues goals. Idle threshold is 60 seconds — GIA checks for pending work every 30 seconds.

## ⏰ Scheduled Tasks

Schedule recurring AI operations:

1. Create a task via GIA (e.g., "summarize the news every morning")
2. Choose interval: Hourly, Daily, or Weekly
3. GIA executes the prompt on schedule and notifies you with results

Scheduled **social media posts** are auto-published when their due time arrives — no manual action needed.

Configure and manage scheduled tasks in Settings or via the Planner module.

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

## 🩺 Device Health Monitoring

GIA proactively monitors your device's health and alerts you to risks:

- **Storage**: Warning at >75%, critical alert at >90% full
- **Battery**: Low at <30%, critical at <15% — with charging status
- **Memory**: Pressure level detection and alerts
- **Trigger**: Automatic periodic checks by the proactive assistant, or manual via `device_health` tool
- **Notification**: Alerts delivered as system notifications with actionable advice

## 🏗 Build & Install Tools

GIA can extend itself dynamically:

- **`build_project`**: Scaffolds files, runs build commands, and packages the result into a downloadable ZIP. Supports multiple languages and frameworks.
- **`install_skill`**: Fetches skill definitions from a URL, built-in registry (developer/researcher/tutor/creative/security), or `data:` URI — instantly expanding GIA's behavior and tool access.

## 💾 Memory Management Tools

GIA can persist and manage what it knows about you:

- **`save_memory`**: Proactively save facts, preferences, goals, and context. Upserts by key.
- **`forget_memory`**: Delete memories by exact key, by `category` filter, or clear all.

GIA uses these automatically — when you share something worth remembering, it saves it without being asked.

## 🎭 GIA Identity

Configure GIA's persona in Settings → Identity:

- **Name**: What GIA should be called
- **Personality**: Warm / Professional / Witty / Direct / Custom (with custom prompt)
- **Tone**: casual, formal, technical, poetic, academic, playful
- **Focus Areas**: Subjects GIA should prioritize (add/remove)
- **Proactiveness**: Reserved ↔ Proactive slider controlling background goal pursuit
- **Allow Memory**: Let GIA remember you across conversations

## 🔌 Plugin Management

Settings → Plugins provides a full management interface:

- **Plugin List**: View installed plugins with enable/disable toggles
- **Install from URL**: Fetch manifest.json + optional hooks/index.js from any URL
- **Install from File**: Upload a `.json` manifest file
- **Lifecycle Hooks**: Plugins can hook into `onInit`, `onActivate`, `onDeactivate`, `onBeforeGenerate`, `onAfterGenerate`, `onToolRegister`
- **Tool Registration**: Plugins can register custom tools dynamically
- **Manifest Reference**: Inline documentation of the plugin manifest format

## 🎨 Custom Skill Editor

Settings → Skills lets you create custom assistant personas:

- **Name**: Editable skill name
- **System Prompt**: Custom instructions textarea
- **Tool Assignment**: Toggle buttons (web_search, terminal_run, filesystem_read/write, image_generation, location, etc.)
- **Delete**: Remove custom skills
- **Categories**: Core / User / Dev / Creative display

## 🧪 Developer Settings

Advanced configuration in Settings → Developer:

- **Show Token Usage**: Display token counts after each response
- **Console Log Level**: Debug / Log / Warn / Error selector
- **HuggingFace Access Token**: For gated/private HuggingFace model downloads
- **Network Monitor**: Start/stop capturing network requests with live log display
- **Cache Management**: Browser cache info display with "Clear Caches" button
- **Debug Info**: User agent, platform, screen, localStorage keys count

## 🏠 Long-Running Mode

Prevent the app from sleeping during extended tasks (Settings → Power):

- **Screen Wake Lock**: Prevents screen dimming
- **Background Heartbeat**: Prevents browser tab suspension
- **Auto-Unload Idle Models**: Frees Whisper, Vision, and local LLM after 10min of inactivity

## 🎙 Voice & Wake Word Settings

Full configuration in Settings → Voice:

- **Wake Word Access Key**: Picovoice Porcupine access key input
- **Sensitivity Slider**: 0–1 sensitivity for native wake word detection
- **Test Wake Word**: Button with detection event log (confidence %, timestamp)
- **Service Status**: Badges showing running/idle/error state
- **On-Device Whisper**: Download ~50MB ONNX model — toggle between local Whisper and browser STT
- **Wake Word Diagnostics**: Mic permission indicator, model loaded status

## 👁 On-Device Vision Management

Settings → Vision provides model lifecycle management:

- **Model Download**: List and download ONNX vision models (captioning, OCR, detection, classification)
- **Confidence Threshold**: 0.1–1.0 slider — below threshold falls back to provider vision
- **Provider Fallback**: Enable/disable automatic fallback to GPT-4o/Gemini/Claude
- **Usage Dashboard**: Local vs provider call counts, average latencies, error stats
- **Reset Statistics**: Clear all usage data

## ⚡ Code Execution Configuration

Settings → Code Execution:

- **Custom Piston Endpoint**: Configure a self-hosted Piston API server URL
- **Piston API Key**: Required since Feb 2026 for public Piston API
- **Test Connection**: Verify endpoint with success/fail feedback
- **Show Languages**: Fetch and display available runtimes
- **Run History**: View full history with language, timestamp, exit code, code snippet — clear with confirmation

## 🔍 Search Provider Configuration

Settings → Search:

- **Exa Search API Key**: AI-native search engine
- **Browserless.io API Key**: Headless browser service
- **Active Provider**: Switch between configured providers
- **Fallback**: DuckDuckGo/Google/Bing via CORS proxies when no API key configured

## 📅 Calendar Integration

Connect Google Calendar via OAuth for full event management:

- **Connect**: OAuth flow for Google Calendar access
- **Events**: List, create, update, delete calendar events
- **Status**: Connection health monitoring

Tools: `calendar_connect`, `calendar_disconnect`, `calendar_status`, `calendar_list_events`, `calendar_create_event`, `calendar_update_event`, `calendar_delete_event`

## ✉️ Email Integration

Connect Gmail via OAuth for email management:

- **Connect**: OAuth flow for Gmail access
- **Send**: Compose and send emails
- **List**: Browse inbox messages
- **Read**: View email content
- **Search**: Search through messages

Tools: `email_connect`, `email_disconnect`, `email_status`, `email_send`, `email_list`, `email_read`, `email_search`

## 💬 Messaging Platforms

Connect WhatsApp and Telegram for messaging automation:

- **WhatsApp**: Send messages via WhatsApp
- **Telegram**: Full bot integration with mention-only mode
- **Status**: Per-platform connection monitoring
- **Disconnect**: Remove platform configuration

Tools: `messaging_status`, `messaging_setup_telegram`, `messaging_setup_whatsapp`, `messaging_disconnect`, `messaging_send`, `messaging_set_mention_only`

## 📖 Bible & Devotion Tools

Personal faith integration tools:

- **Bible Verse**: Verse of the day, chapter reading, or search by reference
- **Daily Devotion**: Fetch daily devotional content
- **Morning Briefing**: Configurable daily morning summary
- **Set Reminder**: Schedule personalized reminders
- **Play Music**: Play audio tracks via tool command

Tools: `bible_verse`, `daily_devotion`, `setup_morning_briefing`, `set_reminder`, `play_music`

## 🔔 Notification Tools

GIA can send, schedule, and manage native push notifications:

- **Send**: Send instant local push notifications
- **Schedule**: Schedule notifications for future delivery
- **Cancel**: Cancel pending notifications
- **List**: View all pending notifications
- **Permissions**: Check and request notification permissions

Tools: `notifications_send`, `notifications_schedule`, `notifications_cancel`, `notifications_pending`, `notifications_check_permissions`, `notifications_request_permissions`

## 📍 Geolocation Tools

Granular GPS location management:

- **Current Position**: Get precise location with accuracy, altitude, and speed
- **Watch Position**: Continuously monitor position changes
- **Clear Watch**: Stop position monitoring
- **Permissions**: Check and request location permissions

Tools: `geolocation_get_current_position`, `geolocation_watch_position`, `geolocation_clear_watch`, `geolocation_check_permissions`, `geolocation_request_permissions`

## 📳 Haptic Patterns

Beyond simple vibration, GIA offers 3 dedicated haptic feedback tools:

- **Impact**: Light, medium, or heavy impact feedback
- **Notification**: Success, warning, or error notification patterns
- **Custom Vibrate**: Custom vibration patterns

Tools: `haptic_impact`, `haptic_notification`, `haptic_vibrate`

## ⚙️ Gateway Daemon

GIA includes a background daemon that runs 24/7 for continuous gateway operations:

- **Start**: Launch the daemon in the proot+Alpine terminal
- **Stop**: Gracefully stop the daemon
- **Status**: Check daemon health and uptime
- **Logs**: View recent daemon activity

Tools: `gateway_daemon_start`, `gateway_daemon_stop`, `gateway_daemon_status`, `gateway_daemon_logs`

## ☁️ Brain Cloud Backup

Beyond local export/import, GIA can sync your brain to cloud storage (Settings → Brain Export → Cloud Backup):

- **WebDAV**: Connect to any WebDAV endpoint
- **S3-Compatible**: Connect to any S3-compatible object store
- **Config**: Endpoint URL, username, password
- **Upload Now**: One-click sync

## 🔄 Proactive Background Engine

Beyond autonomous goals, GIA runs a proactive engine during user idle time:

- **Time-Aware Greetings**: Contextual salutations based on time of day
- **Contextual Suggestions**: Proactive feature suggestions
- **Tips & Tricks**: Usage tips based on current context
- **Personality-Driven**: Messages match configured identity personality
- **Full Autonomy Mode**: When enabled in Protocols settings, GIA executes all tools without asking for approval — per-tool auto-approval can be configured for granular control

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Toggle Command Palette |
| `Cmd+N` | New Session |
| `Cmd+Shift+S` | Open Settings |
| `Cmd+Shift+O` | Toggle Protocol Panel |
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
- **NVIDIA NIM** — NVIDIA's hosted inference (Llama, Mistral, Nemotron, etc.)
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
