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
| **Voice (enhanced)** | Reactive wake word, transcript noise rejection, debounced mic reengagement |

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

## 🎙 Voice

- **Wake word:** "Hey Gia" (works in background on Android with overlay permission)
- **Push-to-talk:** Tap mic icon in chat toolbar
- **Transcript polishing:** Automatic noise rejection and cleanup

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

*Built by Samuel Mensah · Alpha-1 Studio, Ghana*
*GIA is private. Your keys and data stay on your device.*
