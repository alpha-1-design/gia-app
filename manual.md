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

## 🛠 Core Modules

| Module | Purpose |
|--------|---------|
| **Chat** | Primary workspace with full agentic tools and visualizations |
| **Analyst** | Deep research + data analysis with persistent memory |
| **Writer** | Professional drafting and creative writing |
| **Planner** | Task management and goal-oriented execution |
| **Exam** | Educational assessment, WASSCE-tuned testing |
| **Settings** | API keys (Engine Room), skills management, theme, export data |

## 🤖 Tools Available to GIA

Enable **Hands-off Mode** in Settings for fully autonomous operation:

| Tool | Purpose |
|------|---------|
| `web_search` | Real-time DuckDuckGo search with source citations |
| `terminal_run` | Execute code via Piston API (Python, JS, C++, more) |
| `filesystem_read` | Read files from device storage |
| `filesystem_write` | Write files to device storage |
| `image_generation` | Generate and inline images via DALL-E 3 |
| `zip_project` | Bundle project files into .zip |
| `sub_agent_call` | Delegate to another AI provider/model for sub-tasks |
| `request_clarification` | Ask user a single clarifying question |

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

#### About "Hey Google" in the code

Porcupine ships with free built-in keywords (`HEY_GOOGLE`, `COMPUTER`, `ALEXA`, `JARVIS`) for testing without training a custom model. The default fallback uses `HEY_GOOGLE`. To use "Hey GIA" as a native keyword:

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

Tap `/` in Chat to open the command palette. Switch between **Developer Mode**, **General Assistant**, or your own **Custom Skills**.

## ⚙️ Skills

1. Go to **Settings → Neural Skills**
2. Tap **+** to create a custom assistant
3. Define system prompt + allowed tools
4. Skills appear in `/` command palette

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

## 🖥 Engine Room

Configure provider API keys in Settings → Engine Room:

- **Anthropic** — CLAUDE.md key
- **OpenAI** — GPT-4o, o1, o3, o4-mini
- **Gemini** — Google AI Flash/Pro
- **Groq** — Ultra-fast inference
- **OpenRouter** — 100+ models

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
