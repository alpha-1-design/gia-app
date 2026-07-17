import { motion } from 'motion/react'
import { Cpu, Database, KeyRound, GitBranch, Lock, Cloud, ShieldCheck } from 'lucide-react'

const pillars = [
  {
    icon: Cpu,
    title: 'Local LLM',
    desc: 'Qwen2.5 (0.5B–3B) runs on-device via Transformers WASM. Summarize, classify, and chat with zero round-trips.',
  },
  {
    icon: Database,
    title: 'On-Device RAG',
    desc: 'Embeddings and vector search happen locally with ONNX. Your documents never leave the phone.',
  },
  {
    icon: KeyRound,
    title: 'Zero-Key Core',
    desc: 'Memory, RAG, and translation work with no API key. A personal assistant that needs no account.',
  },
  {
    icon: GitBranch,
    title: 'Cloud When You Want',
    desc: 'Heavy reasoning, code, and creative work offload to the provider you choose — your call, your toggle.',
  },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } },
}

export function OnDevice() {
  return (
    <section id="on-device" className="relative py-32 bg-[#050508] overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="hero-glow top-1/3 left-1/4 bg-violet-600" />
        <div className="hero-glow bottom-1/4 right-1/4 bg-emerald-500" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            <ShieldCheck size={12} />
            On-Device by Architecture
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Intelligence that{' '}
            <span className="gradient-text">stays with you.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Not “private by promise” — private by design. The personal layer runs on your device; the cloud is an option, never a requirement.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Pillars */}
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {pillars.map((p) => (
              <motion.div
                key={p.title}
                variants={item}
                className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-emerald-500/20 card-hover"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/15 transition-colors">
                  <p.icon size={20} className="text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold text-zinc-200 mb-2">{p.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Animated device mock */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-6 shadow-2xl shadow-violet-500/5 backdrop-blur">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                <span className="text-xs font-semibold text-zinc-300 tracking-wide">GIA · On-Device Mode</span>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">Summarize my notes</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400">
                      <Lock size={9} /> on-device
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-violet-500"
                      initial={{ width: '0%' }}
                      whileInView={{ width: '100%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, ease: 'easeInOut' }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">Architect a microservice</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold text-violet-400">
                      <Cloud size={9} /> cloud
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                      initial={{ width: '0%' }}
                      whileInView={{ width: '100%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, delay: 0.3, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              </div>

              <p className="mt-5 text-[11px] text-zinc-600 leading-relaxed">
                Every response carries a tag. You always know what ran on your device and what touched the cloud.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
