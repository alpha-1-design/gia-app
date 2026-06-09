# GIA v2.3.1.0 — Generative Interface Agent

<div align="center">

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
- **Custom wake word** — the shipped fallback uses `HEY_GOOGLE` (a free built-in Porcupine keyword for testing). To use a custom "Hey GIA" model, train one at [Picovoice Console](https://console.picovoice.ai/) and place the `.ppn` file in `android/app/src/main/assets/`.

### Why `HEY_GOOGLE` appears in the code

Porcupine ships with free built-in keywords (`HEY_GOOGLE`, `COMPUTER`, `ALEXA`, `JARVIS`, etc.) for development/testing without training a custom model. The code uses `HEY_GOOGLE` as the default keyword. The JS configuration on the settings page still shows "hey gia" — the two are independent:
- The **JS-side** wake word ("hey gia") is used by the browser-based fallback (regex on STT transcript)
- The **native** Porcupine keyword (`HEY_GOOGLE`) is used by the Android foreground service
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
