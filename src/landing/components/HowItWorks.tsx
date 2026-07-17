import { motion } from 'motion/react'
import { MessageSquare, Brain, Cpu, Wrench, Database, ChevronRight } from 'lucide-react'

const steps = [
  {
    icon: MessageSquare,
    title: 'You prompt',
    desc: 'Type, speak, drop a file, or share from another app. GIA captures your input, attachments, and live context.',
  },
  {
    icon: Brain,
    title: 'GiaBrain orchestrates',
    desc: 'Builds your system prompt from identity, memory, and tools — then picks the best model for the job (local or cloud).',
  },
  {
    icon: Cpu,
    title: 'The model streams',
    desc: 'OpenAI, Anthropic, Gemini, or an on-device LLM responds token-by-token with real-time streaming.',
  },
  {
    icon: Wrench,
    title: 'Tools run in a loop',
    desc: 'GIA extracts tool calls, executes them safely, and feeds results back — up to 10 reasoning iterations.',
  },
  {
    icon: Database,
    title: 'Memory sticks',
    desc: 'Useful facts are saved to your on-device memory and recalled next time, so GIA actually learns you.',
  },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 130, damping: 18 } },
}

export function HowItWorks() {
  return (
    <section id="how" className="relative py-32 bg-[#050508]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            How It Works
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            From your words{' '}
            <span className="gradient-text">to real action.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            A transparent pipeline you can actually follow — no black box, no mystery calls.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-5 gap-4"
        >
          {steps.map((s, i) => (
            <motion.div key={s.title} variants={item} className="relative">
              <div className="h-full p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-violet-500/20 card-hover">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/10 flex items-center justify-center">
                    <s.icon size={18} className="text-violet-400" />
                  </div>
                  <span className="text-[11px] font-mono text-zinc-600">0{i + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-zinc-100 mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight
                  size={18}
                  className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-zinc-700 z-10"
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
