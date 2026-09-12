import { motion } from 'motion/react'
import { Sparkles, Download, Github, ArrowRight, Smartphone, Cpu, Shield, Boxes, RefreshCcw } from 'lucide-react'
import { DesktopMock } from './DesktopMock'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#050508] pt-20">
      <div className="absolute inset-0 overflow-hidden">
        <div className="hero-glow top-1/4 left-1/4 bg-violet-600" />
        <div className="hero-glow bottom-1/4 right-1/5 bg-cyan-500" />
        <div className="hero-glow top-1/3 right-1/3 bg-fuchsia-600" />
        <div className="absolute inset-0 bg-grid-fine" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(168,85,247,0.9), transparent 60%)',
        }} />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left: copy */}
          <div className="flex-1 text-center lg:text-left max-w-xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold mb-6 tracking-widest uppercase">
                <Sparkles size={12} />
                Desktop released
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  LINUX
                </span>
                v0.1.0
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-5"
            >
              <span className="text-white">Meet GIA Desktop.</span>
              <br />
              <span className="aurora-text">Your AI coworker</span>
              <br />
              <span className="text-zinc-500">on your machine.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg text-zinc-500 max-w-lg mb-8 leading-relaxed"
            >
              GIA Cowork is the full on-device AI workspace for Linux — a real terminal,
              your files, a sandbox, <span className="text-zinc-300">270+ tools</span>, local voice,
              and a floating orb that watches your screen. Your phone pairs right in on the same network.
              <span className="text-zinc-400"> No cloud. No telemetry. No compromises.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-3 mb-10"
            >
              <a
                href="#download"
                className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 hover:brightness-110 text-sm font-semibold text-white shadow-2xl shadow-violet-500/30 transition-all duration-300 bg-[length:200%_200%] animate-fade-up"
              >
                <Download size={16} />
                Download for Linux
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="https://github.com/alpha-1-design/gia-app/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-sm font-medium text-zinc-300 hover:text-white transition-all"
              >
                <Smartphone size={16} />
                Get the phone app
              </a>
              <a
                href="https://github.com/alpha-1-design/gia-cowork"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-sm font-medium text-zinc-400 hover:text-white transition-all"
              >
                <Github size={16} />
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex items-center justify-center lg:justify-start gap-2 text-[11px] mb-10 text-zinc-600"
            >
              <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-zinc-500">
                Linux ships today
              </span>
              <span className="text-zinc-700">·</span>
              <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1">
                Windows <span className="text-zinc-300 font-semibold">coming soon</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1">
                iOS <span className="text-zinc-300 font-semibold">coming soon</span>
              </span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                { icon: Shield, label: '100% Private', desc: 'No cloud dependency' },
                { icon: Cpu, label: 'Native Tauri', desc: 'Rust core, Chromium UI' },
                { icon: Boxes, label: '270+ Tools', desc: 'Terminal, files, sandbox' },
                { icon: RefreshCcw, label: 'Self-Updating', desc: 'Streams + installs releases' },
              ].map((item) => (
                <div key={item.label} className="card-glow glass flex flex-col items-center gap-1.5 p-3 rounded-xl">
                  <item.icon size={18} className="text-violet-400" />
                  <div className="text-xs font-semibold text-zinc-200">{item.label}</div>
                  <div className="text-[10px] text-zinc-600">{item.desc}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: desktop mock */}
          <div className="flex-1 w-full max-w-[560px] lg:max-w-none">
            <DesktopMock />
          </div>
        </div>
      </div>
    </section>
  )
}