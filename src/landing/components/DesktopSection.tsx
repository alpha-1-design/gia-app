import { motion } from 'motion/react'
import {
  Terminal,
  Boxes,
  Eye,
  AudioLines,
  Brain,
  RefreshCcw,
  Network,
  Shield,
  Server,
  Cpu,
  Zap,
  MessageSquare,
  Fingerprint,
  Workflow,
  Lock,
} from 'lucide-react'

const groups = [
  {
    label: 'workspace',
    cards: [
      {
        title: 'A workspace that acts',
        desc: 'A real shell, a real filesystem, and a sandbox — not a simulator. GIA runs real commands, reads real output, and loops until your task is done.',
        how: 'Rust subprocess layer spawns commands; stdout/stderr streams back into the brain on every turn.',
        icon: Terminal,
        size: 'col-span-2',
        accent: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20',
        iconColor: 'text-cyan-400',
      },
      {
        title: '270+ tools',
        desc: 'Terminal, files, sandbox, code runner, browser, database, SSH, build, geolocation, smart-home, notifications, calendar, email — and a live catalog you can browse.',
        how: 'The model picks from the full catalog on every turn. A per-tool capability policy (allow / ask / deny) governs what runs unattended.',
        icon: Boxes,
        accent: 'from-violet-500/15 to-violet-500/5 border-violet-500/20',
        iconColor: 'text-violet-400',
      },
      {
        title: 'Skills & workflows',
        desc: 'Save any task as a reusable skill — a prompt template plus tool preferences — and run it from the chat or the command palette.',
        how: 'Skills persist in local JSON and are passed into the system prompt on demand.',
        icon: Workflow,
        accent: 'from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/20',
        iconColor: 'text-fuchsia-400',
      },
    ],
  },
  {
    label: 'perception',
    cards: [
      {
        title: 'Jarvis eyes — the floating orb',
        desc: 'A draggable glass sphere that watches your screen on a 20-second ambient loop. It captions what it sees, reads on-screen text, and can act — moving the mouse, clicking, typing — then verifies the result.',
        how: 'Local ONNX vision models (or your connected vision provider). Screenshots never leave the machine. Pauses on screen lock.',
        icon: Eye,
        size: 'col-span-2',
        accent: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
        iconColor: 'text-emerald-400',
      },
      {
        title: 'Voice that\'s local',
        desc: 'Kokoro TTS (82 M, near-ElevenLabs), Whisper STT, model-native voices — all in-browser via WebGPU / WASM. A cloud fallback (OpenAI, Groq) is available when you want it.',
        how: 'ONNX runtimes are cached after first download. Audio is synthesised and played locally; cloud STT is opt-in and labeled.',
        icon: AudioLines,
        accent: 'from-pink-500/15 to-pink-500/5 border-pink-500/20',
        iconColor: 'text-pink-400',
      },
      {
        title: 'Any provider',
        desc: 'OpenAI, Anthropic, Google Gemini, local llama.cpp / Ollama — one workspace, many brains. The orb, voice, and tools all work the same way regardless of which model you chose.',
        how: 'ProviderService normalises every request behind a common interface; model-specific quirks (image gating, context limits) are handled automatically.',
        icon: Cpu,
        accent: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
        iconColor: 'text-amber-400',
      },
    ],
  },
  {
    label: 'data & privacy',
    cards: [
      {
        title: 'Memory & brain export',
        desc: 'Full chat history, tool results, and learned context — exported as a single portable JSON file. Import it on another device or into a fresh install.',
        how: 'The brain is stored in IndexedDB on the phone and on the local filesystem on the desktop. Export is a single file; import restores everything.',
        icon: Brain,
        accent: 'from-violet-500/15 to-violet-500/5 border-violet-500/20',
        iconColor: 'text-violet-400',
      },
      {
        title: 'Self-updating daemon',
        desc: 'Close the window and GIA stays alive in the tray. On next launch it checks GitHub for newer releases, streams them to ~/Downloads with a live progress bar, then installs and relaunches itself.',
        how: 'AppImage: chmod +x + setsid relaunch. deb: pkexec dpkg -i. rpm: rpm -Uvh. The update card shows install state + progress.',
        icon: RefreshCcw,
        accent: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
        iconColor: 'text-emerald-400',
      },
      {
        title: 'Privacy by default',
        desc: 'No telemetry, no analytics, no cloud dependency. Screen captures are processed locally. You can delete anything — messages, history, tools — at any time.',
        how: 'The app is a single Tauri binary. No background services phone home. The only outbound connections are the AI provider you chose and the LAN mesh.',
        icon: Shield,
        accent: 'from-sky-500/15 to-sky-500/5 border-sky-500/20',
        iconColor: 'text-sky-400',
      },
      {
        title: 'Zero tracking',
        desc: 'No cookies, no fingerprinting, no remote analytics. The app does not even embed a tracking pixel.',
        how: 'Tauri allows you to audit every outbound request. The webview is yours.',
        icon: Fingerprint,
        accent: 'from-zinc-500/15 to-zinc-500/5 border-zinc-500/20',
        iconColor: 'text-zinc-400',
      },
    ],
  },
  {
    label: 'infra',
    cards: [
      {
        title: 'Mesh & phone pairing',
        desc: 'Cross-device mesh over your LAN — your phone and desktop are one brain. Capability profiles swap automatically; the phone brings camera, SMS, location; the desktop brings the full shell.',
        how: 'Embedded Unimind relay (ws://127.0.0.1:8787). Pairing id = room key. Same network, same key = one device.',
        icon: Network,
        size: 'col-span-2',
        accent: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20',
        iconColor: 'text-cyan-400',
      },
      {
        title: 'WhatsApp bridge',
        desc: 'Two-way WhatsApp messaging through a Baileys sidecar — live QR pairing, incoming message push, auto-respond, full thread history.',
        how: 'Rust supervisor spawns the sidecar; events stream into the React UI; messages flow through the same brain that powers the chat.',
        icon: MessageSquare,
        accent: 'from-green-500/15 to-green-500/5 border-green-500/20',
        iconColor: 'text-green-400',
      },
      {
        title: 'Rust core',
        desc: 'Terminal subprocesses, screen capture, presence tracking, WhatsApp bridge, embedded relay — all native Rust via Tauri. Fast startup, small footprint, no Electron.',
        how: 'Tauri 2 invoke boundary bridges Rust ↔ TypeScript. Commands are typed and validated on both sides.',
        icon: Server,
        accent: 'from-orange-500/15 to-orange-500/5 border-orange-500/20',
        iconColor: 'text-orange-400',
      },
      {
        title: 'Capability policy',
        desc: 'Per-tool allow / ask / deny — set once, respected on every future call. Deny a tool and GIA will never run it without asking first.',
        how: 'CapabilityPolicyService persists to localStorage; tools check it before execution; the mesh advertises policy across devices.',
        icon: Lock,
        accent: 'from-red-500/15 to-red-500/5 border-red-500/20',
        iconColor: 'text-red-400',
      },
    ],
  },
]

export function DesktopSection() {
  return (
    <section id="desktop" className="relative py-28 overflow-hidden bg-[#050508]">
      <div className="absolute inset-0 bg-grid-fine" />
      <div className="absolute inset-0">
        <div className="hero-glow top-1/4 left-1/6 bg-cyan-600 opacity-15" />
        <div className="hero-glow bottom-1/4 right-1/6 bg-violet-600 opacity-15" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-5 tracking-wider uppercase">
            <Zap size={12} />
            What GIA Desktop can do
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
            Not a chatbot. <span className="aurora-text">A full workspace.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Everything the phone does — plus a real Linux shell, real files, real GPU, and
            a floating orb that watches your screen and acts on your behalf. The same brain,
            running on better hardware.
          </p>
        </motion.div>

        {groups.map((g) => (
          <div key={g.label} className="mb-8 last:mb-0">
            <div className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase mb-4 px-1">
              {g.label}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {g.cards.map((c, i) => (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className={`card-glow flex flex-col rounded-2xl border bg-gradient-to-b p-6 ${c.accent} ${c.size || ''}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                      <c.icon size={16} className={c.iconColor} />
                    </div>
                    <div className="text-sm font-bold text-white leading-tight">{c.title}</div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3 flex-1">{c.desc}</p>
                  <div className="flex items-start gap-2 mt-auto pt-3 border-t border-white/[0.05]">
                    <span className="text-[9px] font-bold text-zinc-600 uppercase shrink-0 mt-0.5">How it works</span>
                    <span className="text-[10px] text-zinc-500 leading-relaxed italic">{c.how}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}