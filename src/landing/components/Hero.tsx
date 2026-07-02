import { motion } from 'motion/react'
import { Sparkles, Download, Github, ArrowRight, Shield, Cpu, Wifi, Lock } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#050508] pt-20">
      <div className="absolute inset-0 overflow-hidden">
        <div className="hero-glow top-1/4 left-1/4 bg-violet-600" />
        <div className="hero-glow bottom-1/4 right-1/5 bg-cyan-500" />
        <div className="hero-glow top-1/3 right-1/3 bg-indigo-600" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: [
              'linear-gradient(rgba(168,85,247,0.3) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(168,85,247,0.3) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-24 lg:py-32">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-8 tracking-widest uppercase">
              <Sparkles size={12} />
              v2.3.1 — Now Available
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
          >
            <span className="gradient-text">Your AI.</span>
            <br />
            <span className="text-white">Your Device.</span>
            <br />
            <span className="text-zinc-500">Your Privacy.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-zinc-500 max-w-2xl mb-10 leading-relaxed"
          >
            GIA is a private, on-device AI workspace that runs entirely on your machine.
            <span className="text-zinc-400"> No cloud. No telemetry. No compromises.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-16"
          >
            <a
              href="https://github.com/alpha-1-design/gia-app/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-base font-semibold text-white shadow-2xl shadow-violet-500/25 transition-all duration-300"
            >
              <Download size={18} />
              Download APK
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="https://github.com/alpha-1-design/gia-app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-base font-medium text-zinc-400 hover:text-white transition-all"
            >
              <Github size={18} />
              View on GitHub
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-3xl"
          >
            {[
              { icon: Shield, label: '100% Private', desc: 'No cloud dependency' },
              { icon: Cpu, label: 'On-Device', desc: 'Runs locally' },
              { icon: Wifi, label: 'Offline Capable', desc: 'No internet needed' },
              { icon: Lock, label: 'Zero Telemetry', desc: 'No tracking ever' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <item.icon size={20} className="text-violet-400" />
                <div className="text-sm font-semibold text-zinc-200">{item.label}</div>
                <div className="text-[11px] text-zinc-600">{item.desc}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
