# GIA v2.3.1 — Generative Interface Agent

**GIA (Generative Interface Agent)** is a private, on-device AI workspace that runs entirely inside a Capacitor + React + TypeScript shell. No server, no backend, no cloud dependency except the AI model API calls you explicitly configure.

Built by Samuel Mensah · Alpha-1 Studio, Ghana

---

## Architecture

```
┌─────────────────────────────────────┐
│  Capacitor WebView (Android/iOS)    │
│  ┌───────────────────────────────┐  │
│  │  React 18 + TypeScript        │  │
│  │  Vite + Tailwind v4           │  │
│  │  Zustand (persisted to IndexedDB) │
│  ├───────────────────────────────┤  │
│  │  Modules:                     │  │
│  │  Chat  ·  Exam  ·  Analyst    │  │
│  │  Writer · Planner · Settings  │  │
│  ├───────────────────────────────┤  │
│  │  Services:                    │  │
│  │  GiaBrain (agentic loop)      │  │
│  │  GiaTools  (tool registry)    │  │
│  │  SearchService (DuckDuckGo)   │  │
│  │  CodeRunner (sandboxed exec)  │  │
│  │  TTSService (native / Web Speech)│ │
│  │  SchedulerService             │  │
│  └───────────────────────────────┘  │
│  Capacitor Plugins:                 │
│  Filesystem · SpeechRecognition ·   │
│  TextToSpeech · LocalNotifications  │
│  NativeBiometric · CapacitorHttp    │
└─────────────────────────────────────┘
```

## Key Features

- **Agentic Loop** — GIA can reason, call tools, observe results, and iterate (up to 8 turns autonomously)
- **Multi-Provider AI** — Switch between OpenRouter, Anthropic, OpenAI, Gemini, Groq
- **Hands-Off Mode** — Let GIA execute tools autonomously without asking permission
- **Web Search** — Real-time DuckDuckGo search integrated into the reasoning loop
- **Voice Control** — Wake-word ("Hey Gia"), listen-respond cycle with 2s back-off gate
- **Memory System** — Persistent key-value store with categories, confidence scoring, and keyword-boosted relevance ranking
- **Skills Engine** — User-defined custom skills with per-skill system prompts and tool access
- **Streaming Responses** — Token-by-token streaming from all 3 provider APIs (OpenAI-compat, Anthropic, Gemini)
- **Extended Thinking** — On-demand step-by-step reasoning for complex problems
- **Sub-Agent Delegation** — GIA can spawn sub-agents on different providers for specialized tasks
- **Image & Document Upload** — Vision models supported; PDFs processed up to 30K chars
- **Code Execution** — Sandboxed Python, JS, C++, and more via Pyodide/CodeRunner
- **Filesystem** — Full read/write/list on Android (Capacitor Filesystem), browser download fallback
- **ZIP Export** — Bundle project files into downloadable `.zip` via JSZip
- **TTS** — Text-to-speech via native engine (Android) or Web Speech API (browser)
- **Biometric Lock** — Fingerprint/face unlock via NativeBiometric

## Modules

| Module | Purpose |
|--------|---------|
| **Chat** | Primary workspace. Full tool access, multi-modal, streaming. |
| **Exam** | WASSCE-tuned quiz/testing with score tracking and weak-area detection. |
| **Analyst** | Deep research and data analysis mode with persistent memory context. |
| **Writer** | Professional document drafting and editing. |
| **Planner** | Task management, scheduling, and goal tracking with notifications. |
| **Settings** | Provider config, skill management, wake word, biometric lock, profile. |

## Configuration

### AI Providers
Configure one or more providers in Settings → Engine Room:
- **OpenRouter** — gateway to 200+ models
- **Anthropic** — Claude Opus, Sonnet, Haiku
- **OpenAI** — GPT-4o, GPT-4.1, o1, o3
- **Gemini** — Gemini 1.5/2.0 Pro, Flash
- **Groq** — Fast open-weight models (Llama, Mixtral)

### Wake Word
Set a custom wake word in Settings → Voice. Wake word detection runs via `@capacitor-community/speech-recognition` with continuous listening.

### Skills
Create custom AI personas in Settings → Neural Skills. Each skill gets its own system prompt, allowed tools, and appears in the `/` command palette.

## Development

```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server
npm run build            # TypeScript check + production build
npm run preview          # Preview production build
npx cap sync android     # Sync Capacitor with Android
npx cap open android     # Open Android Studio
```

### CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/build-apk.yml`) that:
1. Installs dependencies & builds the web app
2. Syncs Capacitor Android
3. Assembles debug & release APKs
4. Uploads artifacts

## Project Structure

```
src/
├── App.tsx                 # Root — modals, scheduler init, TTS init
├── main.tsx                # Entry point
├── components/
│   ├── AmbientInput.tsx    # Chat input bar (voice, upload, send)
│   ├── ThinkingPanel.tsx   # Collapsible reasoning panel
│   └── ...                 # UI primitives
├── hooks/
│   └── useVoiceControl.ts  # Speech recognition lifecycle
├── modules/
│   ├── ChatModule.tsx      # Main conversation UI + generate loop wiring
│   ├── SettingsModule.tsx  # Provider config, wake word, skills, profile
│   └── ...                 # Exam, Analyst, Writer, Planner
├── services/
│   ├── GiaBrain.ts         # Agentic loop, provider calls, memory extraction
│   ├── GiaTools.ts         # Tool registry (search, fs, code, zip, etc.)
│   ├── SearchService.ts    # DuckDuckGo integration
│   ├── CodeRunner.ts       # Pyodide-based sandboxed execution
│   ├── TTSService.ts       # TTS abstraction layer
│   └── SchedulerService.ts # Notification-based task scheduler
├── store/
│   ├── useGiaStore.ts      # Global app state (Zustand + IndexedDB)
│   ├── useMemoryStore.ts   # Persistent memory (categories, confidence, relevance)
│   ├── useProviderStore.ts # AI provider configs
│   └── idb-storage.ts      # IndexedDB persistence adapter
├── styles/
│   └── globals.css         # Tailwind v4 + custom styles
└── utils/
    └── ...                 # Helpers
```

## Privacy

GIA is **local-first**. No telemetry, no analytics, no data collection. API keys are stored on-device (IndexedDB) and sent only to the provider you choose. See [`src/privacy.md`](src/privacy.md) for full policy.

## License

Private · Alpha-1 Studio, Ghana
