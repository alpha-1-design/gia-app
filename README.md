# GIA v2.3.1.0 — Generative Interface Agent

<div align="center">

[![License: Private](https://img.shields.io/badge/License-Private-red.svg)](LICENSE)
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

## ✨ Features

| Area | Details |
|------|---------|
| **Agentic Loop** | Autonomous reasoning with multi-turn tool execution, sub-agent delegation |
| **Live Reasoning** | Real-time streaming thought panel during generation |
| **Deep Memory** | On-device persistent memory with relevance scoring, auto-extraction, pinning, and manual fact management |
| **Custom Instructions** | User-defined rules injected into every conversation system prompt |
| **Voice** | Wake-word ("Hey Gia"), push-to-talk, transcript polishing, TTS |
| **Web Search** | DuckDuckGo with formatted citations and clickable source badges |
| **File Operations** | Read/write files (native), ZIP bundling, download triggers (browser) |
| **Code Execution** | Run Python/JS/C++ via Piston API, auto-fix on error |
| **Image Generation** | DALL-E 3 / OpenRouter image models, inline display in chat |
| **Skills System** | Role-based presets (Tutor, Developer, Researcher, Creative, Security) |
| **Knowledge Manager** | Browse, search, filter, pin, add, delete, import, export memories |
| **Conversation Search** | Search across session titles and message content with match count |

### Visualization in Chat

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

### UI Improvements

- Floating stop button during generation
- Phase badges: Thinking… → Generating… → Done
- Model footprint on assistant messages (`via gpt-4o`)
- Streaming cursor (blinking `▋`) during token delivery
- Transparent input area with backdrop blur
- Empty state spacing for new chats

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

Private · Alpha-1 Studio, Ghana
