## 🚀 GIA — Your Autonomous AI Agent that Actually Does Things

**GIA** is an open-source, on-device AI agent that doesn't just chat — it acts. Built as a single-page React 19 app + Capacitor Android APK, GIA runs **fully on your device** with no cloud dependency.

### What makes GIA different?

**🧠 Autonomous & Proactive**
GIA doesn't wait for commands. She monitors device health, scans your network, checks for security threats, remembers everything, and acts on her own initiative. She breaks down high-level goals into steps and works through them.

**🔧 Tool Ecosystem (50+ tools)**
GIA can SSH into servers, query databases, scan networks, send emails, post to social media, WebSocket into anything, execute bash commands, build and ship code projects, scrape the web, and render 3D scenes — all from one unified agent loop.

Tool examples:
- `network_detect` — scans your full /24 LAN subnet, probes 35+ ports, then auto-connects to every discovered service
- `security_scan` / `security_quarantine` — full device forensics with emergency network kill switch
- `ssh_connect` / `db_query` / `ws_connect` — connect to anything, anywhere
- `build_project` — scaffolds, builds, and packages code into a deliverable ZIP in one step

**🎨 Visual-First Responses**
GIA doesn't just text you back. She renders interactive 3D scenes (Three.js), force-directed graphs, maps (OpenStreetMap), charts (Recharts), slide decks, terminal output, mind maps, and more — inline in chat. Visual blocks are used as naturally as text.

**📁 Persistent File Store**
Files uploaded in chat are stored in IndexedDB and survive app restarts. GIA can search, tag, and reference them anytime via tools.

**🔌 Any-Endpoint Connectivity**
GIA connects to anything: SSH, PostgreSQL, MySQL, Redis, MongoDB, WebSocket, HTTP APIs, Kubernetes, Prometheus, Elasticsearch, RabbitMQ — whatever port you find open, she probes it.

**🛡️ Built-in Security Suite**
- Full device vulnerability scanning
- Malware/suspicious process detection  
- IP geolocation + WHOIS tracing
- Threat intelligence (AbuseIPDB, ThreatFox)
- Emergency quarantine (network isolation)
- Auto-installs all security tools via apk

**🤖 Multi-Provider, Local-First**
18+ providers supported (OpenAI, Anthropic, Gemini, Grok, Groq, DeepSeek, Mistral, Cohere, Together, Perplexity, Fireworks, OpenRouter, LM Studio, Ollama, LocalAI, vLLM, Text Generation WebUI, Custom). Can run fully offline with Local LLM (Qwen2.5 0.5B-3B via Transformers WASM).

### Tech Stack
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4
- **State:** Zustand 5 + IndexedDB persistence
- **Animation:** Motion (not Framer Motion)
- **3D:** Three.js (bundled, no CDN)
- **Charts:** Recharts
- **Mobile:** Capacitor (Android APK)
- **Backend:** Alpine Linux sandbox (PRoot, no root needed)
- **LLM Runtime:** Transformers.js (local) + 18 cloud providers

### Looking for Contributors
We're building the first truly autonomous, on-device AI agent that doesn't need the cloud. Areas we need help with:
- iOS/Capacitor port
- Plugin system & MCP server ecosystem
- Local LLM fine-tuning and RAG improvements  
- UI/UX polish
- Security tooling expansion
- Documentation and tutorials

**⭐ Star the repo. Try the APK. Break things. Open issues.**
GIA is built for developers who want an AI that actually ships.

https://github.com/alpha-1-design/gia-app
