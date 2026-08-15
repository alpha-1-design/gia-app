import { motion } from 'motion/react'
import { Sparkles, Download, Github, ArrowRight, Shield, Cpu, Wifi, Lock } from 'lucide-react'
import { MockUI } from './MockUI'

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

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-left max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-6 tracking-widest uppercase">
                <Sparkles size={12} />
                <span className="rounded-full bg-violet-500/20 border border-violet-500/25 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                  BETA
                </span>
                v2.3.3-beta.1 — Latest Release
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-5"
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
              className="text-base sm:text-lg text-zinc-500 max-w-lg mb-8 leading-relaxed"
            >
              GIA is a private, on-device AI workspace that runs entirely on your machine.
              <span className="text-zinc-400"> No cloud. No telemetry. No compromises.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-3 mb-10"
            >
              <a
                href="https://github.com/alpha-1-design/gia-app/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-sm font-semibold text-white shadow-2xl shadow-violet-500/25 transition-all duration-300"
              >
                <Download size={16} />
                Download APK
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="https://github.com/alpha-1-design/gia-app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-sm font-medium text-zinc-400 hover:text-white transition-all"
              >
                <Github size={16} />
                View on GitHub
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                { icon: Shield, label: '100% Private', desc: 'No cloud dependency' },
                { icon: Cpu, label: 'On-Device', desc: 'Runs locally' },
                { icon: Wifi, label: 'Offline Capable', desc: 'No internet needed' },
                { icon: Lock, label: 'Zero Telemetry', desc: 'No tracking ever' },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <item.icon size={18} className="text-violet-400" />
                  <div className="text-xs font-semibold text-zinc-200">{item.label}</div>
                  <div className="text-[10px] text-zinc-600">{item.desc}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Mock UI */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex-1 w-full max-w-[520px] lg:max-w-none"
          >
            <MockUI />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
