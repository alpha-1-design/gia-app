import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import {
  Activity,
  AudioLines,
  Bot,
  ChevronRight,
  Cpu,
  Eye,
  Folder,
  Mic,
  PanelLeft,
  Send,
  Server,
  Sparkles,
  Terminal,
  Wifi,
} from 'lucide-react'

const tools = [
  { icon: Bot, active: true },
  { icon: PanelLeft, active: false },
  { icon: Folder, active: false },
  { icon: Terminal, active: false },
  { icon: Eye, active: false },
]

const thread = [
  { role: 'user', text: 'build a tiny aurora clock for the tray', time: '09:41' },
  { role: 'gia', text: 'Done — a 24h glow dial in ~120 lines of Rust. Installed, running, and the orb picked up your screen.', time: '09:41' },
  { role: 'user', text: 'pair my phone', time: '09:42' },
  { role: 'gia', text: 'Phone is in on the mesh. It brought camera + SMS; I brought the Linux shell. Capabilities synced.', time: '09:42' },
]

function Line({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
      <span className="text-emerald-400">➜</span>
      <span className="text-cyan-300/80">{children}</span>
    </div>
  )
}

export function DesktopMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: 4 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, delay: 0.35 }}
      className="relative w-full select-none"
    >
      {/* ambient aurora hold */}
      <div className="absolute -inset-10 -z-10 overflow-visible">
        <div className="absolute top-6 right-10 w-64 h-64 rounded-full bg-cyan-500/20 blur-[90px]" />
        <div className="absolute bottom-2 left-8 w-72 h-72 rounded-full bg-fuchsia-600/20 blur-[90px]" />
        <div className="absolute top-1/3 left-1/2 w-56 h-56 rounded-full bg-violet-600/20 blur-[100px]" />
      </div>

      <div
        className="relative glass-strong rounded-2xl overflow-hidden shadow-[0_40px_120px_-30px_rgba(168,85,247,0.4)]"
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <span className="nav-dot bg-[#ef4444]/80" />
            <span className="nav-dot bg-[#fbbf24]/80" />
            <span className="nav-dot bg-[#22c55e]/80" />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mx-auto">
            <Sparkles size={10} className="text-violet-400" />
            gia://cowork — desktop
          </div>
          <div className="flex items-center gap-1 text-[9px] text-zinc-500">
            <span className="status-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="hidden sm:inline">daemon</span>
          </div>
        </div>

        <div className="flex">
          {/* Icon rail */}
          <div className="hidden sm:flex flex-col items-center gap-3 py-4 px-2.5 border-r border-white/[0.05]">
            {tools.map((t, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  t.active ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-zinc-600'
                }`}
              >
                <t.icon size={14} />
              </div>
            ))}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
              <Cpu size={14} />
            </div>
          </div>

          {/* Chat column */}
          <div className="flex-1 min-w-0 px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500" />
              <div>
                <div className="text-[11px] font-semibold text-zinc-200 leading-none">GIA Desktop</div>
                <div className="text-[8px] text-emerald-400 leading-tight mt-0.5">● online · mesh 2 devices</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[9px] text-zinc-500">
                <Wifi size={10} className="text-emerald-400" />
                lan
              </div>
            </div>

            <div className="space-y-2.5">
              {thread.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-[9.5px] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-violet-500/20 border border-violet-500/25 text-violet-100'
                        : 'bg-white/[0.04] border border-white/[0.05] text-zinc-300'
                    }`}
                  >
                    {m.text}
                    <div className="mt-1 text-[8px] text-zinc-600">{m.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
              <AudioLines size={11} className="text-fuchsia-400 shrink-0" />
              <span className="text-[9px] text-zinc-500 flex-1 truncate">Ask anything — terminal, files, sandbox, skills…</span>
              <Mic size={11} className="text-emerald-400 shrink-0" />
              <Send size={11} className="text-violet-400 shrink-0" />
            </div>
          </div>

          {/* Side: orb + terminal */}
          <div className="hidden md:block w-[190px] border-l border-white/[0.05] p-3 space-y-3">
            {/* Orb HUD */}
            <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 orbit-slow" />
                  <div className="absolute inset-[3px] rounded-full bg-[#0d0d16]" />
                  <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-cyan-300 via-violet-400 to-fuchsia-400" />
                </div>
                <div>
                  <div className="text-[9px] font-semibold text-zinc-200">Jarvis eyes</div>
                  <div className="text-[8px] text-emerald-400">● seeing</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="px-1.5 py-0.5 rounded text-[7.5px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">whisper</span>
                <span className="px-1.5 py-0.5 rounded text-[7.5px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">kokoro</span>
                <span className="px-1.5 py-0.5 rounded text-[7.5px] bg-violet-500/15 text-violet-300 border border-violet-500/20">vision</span>
              </div>
              <div className="mt-2 text-[8px] leading-relaxed text-zinc-500">
                Shipped the aurora clock · tray PID 4021, 8.1 MB RSS.
              </div>
            </div>

            {/* Terminal */}
            <div className="rounded-xl border border-white/[0.06] bg-[#07070d] overflow-hidden relative">
              <div className="relative overflow-hidden px-3 pt-2.5 pb-6 space-y-1.5">
                <Line>~ cargo run --release</Line>
                <Line>Compiling gia-cowork v0.1.0 …</Line>
                <Line className="text-emerald-300">Finished in 9.4s</Line>
                <Line className="text-zinc-400">────────────────────</Line>
                <Line>nvidia-smi · 12.4 GB free</Line>
                <Line className="text-zinc-400">────────────────────</Line>
                <div className="absolute left-0 right-0 h-8 scanline pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating chips */}
      <div className="absolute -left-3 top-1/3 glass rounded-xl px-3 py-2 flex items-center gap-2 animate-float">
        <Server size={12} className="text-cyan-400" />
        <span className="text-[9px] text-zinc-300">Rust · 270+ tools</span>
      </div>
      <div className="absolute -right-3 bottom-1/4 glass rounded-xl px-3 py-2 flex items-center gap-2 animate-float" style={{ animationDelay: '1.4s' }}>
        <Activity size={12} className="text-emerald-400" />
        <span className="text-[9px] text-zinc-300">updater watching releases</span>
      </div>

      {/* Under-window reflection strip */}
      <div className="mt-4 flex items-center gap-2 text-[9px] text-zinc-600">
        <ChevronRight size={10} />
        <span>Screenshot future work — the orb was watching.</span>
      </div>
    </motion.div>
  )
}