import { motion } from 'motion/react'
import { GraduationCap, Code2, BarChart3, ShieldCheck } from 'lucide-react'

const cases = [
  {
    icon: GraduationCap,
    tag: 'Students',
    color: '#f59e0b',
    title: 'Exam prep that actually teaches',
    points: [
      'Generate WASSCE & BECE quizzes from past questions',
      'Walk through solutions step by step, get instant feedback',
      'Plan a full study week and track what you haven’t mastered',
    ],
  },
  {
    icon: Code2,
    tag: 'Developers',
    color: '#ec4899',
    title: 'A co-worker, not a chatbot',
    points: [
      'Run code, hit the terminal, SSH into servers — from chat',
      'Generate PDFs, reports, and working code inline',
      'Keep a local LLM for private, offline pair-programming',
    ],
  },
  {
    icon: BarChart3,
    tag: 'Analysts',
    color: '#3b82f6',
    title: 'Raw data to clear answers',
    points: [
      'RAG over your own documents with on-device embeddings',
      'Produce charts and structured, JSON-ready analysis',
      'Persistent memory of your metrics, goals, and context',
    ],
  },
  {
    icon: ShieldCheck,
    tag: 'Privacy-first',
    color: '#34d399',
    title: 'Your AI, on your terms',
    points: [
      'No cloud backend, no telemetry, no account required',
      'The personal layer runs entirely on your device',
      'Cloud models are an option you switch on — never a default',
    ],
  },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } },
}

export function UseCases() {
  return (
    <section id="usecases" className="relative py-32 bg-[#050508]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="hero-glow top-1/4 right-1/3 bg-violet-600" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            Who It's For
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Built for <span className="gradient-text">real work.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            One assistant that adapts to how you actually operate.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {cases.map((c) => (
            <motion.div
              key={c.tag}
              variants={item}
              whileHover={{ y: -4 }}
              className="group p-7 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] card-hover"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center border"
                  style={{ background: `${c.color}14`, borderColor: `${c.color}33`, color: c.color }}
                >
                  <c.icon size={20} />
                </div>
                <span
                  className="text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: `${c.color}12`, color: c.color }}
                >
                  {c.tag}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-3">{c.title}</h3>
              <ul className="space-y-2">
                {c.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-zinc-500 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
