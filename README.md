# GIA v2.3.1.0 — Generative Interface Agent

<div align="center">

![GIA Header](src/assets/hero.png)

[![License: Private](https://img.shields.io/badge/License-Private-red.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.3.1.0-emerald.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web-blue.svg)](capacitor.config.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)

**GIA (Generative Interface Agent)** is a private, on-device AI workspace that runs entirely inside a Capacitor + React + TypeScript shell. No server, no backend, no cloud dependency except the AI model API calls you explicitly configure.

[Explore Manual](./manual.md) · [Report Bug](./gia-bug-report.md) · [Contributing](./CONTRIBUTING.md)

</div>

---

## 🚀 Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white) ![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=flat&logo=framer&logoColor=white) |
| **State & Logic** | ![Zustand](https://img.shields.io/badge/Zustand-443E38?style=flat) ![Lucide Icons](https://img.shields.io/badge/Lucide-F7B93E?style=flat) ![JSZip](https://img.shields.io/badge/JSZip-FFD43B?style=flat) |
| **Mobile Shell** | ![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=flat&logo=capacitor&logoColor=white) ![Android](https://img.shields.io/badge/Android-3DDC84?style=flat&logo=android&logoColor=white) |
| **Build Tool** | ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white) |

---

## 🤖 Supported Providers

GIA is model-agnostic and connects directly to the following providers via their standard APIs:

*   **Anthropic:** Native support for Claude 3.5/3.7 with extended thinking budget.
*   **Gemini:** Support for Google Flash/Pro 1.5 & 2.0 with vision and thinking hacks.
*   **OpenAI:** Standard GPT-4o/o1/o3 support and vision capabilities.
*   **Groq:** Ultra-fast Llama-3/Mistral inference.
*   **OpenRouter:** Access to 100+ models including DeepSeek, Llama, and more.
*   **OpenCode:** Specialized provider for high-performance coding tasks.

---

## ✨ Key Features

*   **Agentic Loop:** Fully autonomous reasoning with multi-turn tool execution.
*   **Visible Reasoning:** Live, collapsible "Thinking" panel during token streaming.
*   **Deep Memory:** On-device persistent memory with relevance scoring and auto-extraction.
*   **Native Tools:** Filesystem access, web search, code execution, and image generation.
*   **Local-First Privacy:** API keys stored in IndexedDB; no telemetry or data collection.
*   **Voice Integration:** Wake-word detection ("Hey Gia") and chunked TTS for low-latency speech.

---

## 🛠️ Development

### Prerequisites
*   Node.js (v20+)
*   Android Studio (for mobile builds)

### Setup
```bash
git clone https://github.com/alpha-1-design/gia-app.git
cd gia-app
npm install
```

### Run Locally
```bash
npm run dev
```

### Build APK
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

---

## 📜 Privacy & Security

GIA is designed for **Privacy First**. No telemetry, no analytics, no data collection. API keys are stored on-device (IndexedDB) and sent only to the provider you choose. See [`src/privacy.md`](src/privacy.md) for full policy.

## ⚖️ License

Private · Alpha-1 Studio, Ghana
