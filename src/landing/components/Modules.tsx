import { motion } from 'motion/react'
import {
  MessageCircle, GraduationCap, BarChart2, PenLine,
  ListTodo, Bot, Target, Settings,
} from 'lucide-react'

const modules = [
  {
    icon: MessageCircle, label: 'Chat', color: '#a855f7',
    desc: 'The living workspace. Talk to GIA with live tools, files, persistent memory, and token-by-token streaming.',
  },
  {
    icon: GraduationCap, label: 'Exam', color: '#f59e0b',
    desc: 'WASSCE & BECE prep. Generate quizzes from past questions, walk through solutions, and get instant feedback.',
  },
  {
    icon: BarChart2, label: 'Analyst', color: '#3b82f6',
    desc: 'Turn raw data into insight. Charts, structured reports, and JSON-ready analysis you can act on.',
  },
  {
    icon: PenLine, label: 'Writer', color: '#ec4899',
    desc: 'Drafts, documents, slides, and code. Long-form and visual output, rendered inline as you go.',
  },
  {
    icon: ListTodo, label: 'Planner', color: '#10b981',
    desc: 'Map your week, your study plan, your project. Breaks big goals into calm, actionable steps.',
  },
  {
    icon: Bot, label: 'Agents', color: '#a855f7',
    desc: 'Build autonomous agents with their own memory and RAG. Delegate the work and oversee the result.',
  },
  {
    icon: Target, label: 'Autonomy', color: '#34d399',
    desc: 'Set a goal and let GIA drive toward it — planning, executing, and adapting without hand-holding.',
  },
  {
    icon: Settings, label: 'Settings', color: '#94a3b8',
    desc: 'Providers, connectors, social accounts, and on-device controls. You stay in charge of every switch.',
  },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 18 } },
}

export function Modules() {
  return (
    <section id="app" className="relative py-32 bg-[#050508]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            Inside GIA
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            One app. <span className="gradient-text">Every workflow.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Eight modules, one memory. Switch contexts without losing the thread — GIA carries what it knows across all of them.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {modules.map((m) => (
            <motion.div
              key={m.label}
              variants={item}
              whileHover={{ y: -4 }}
              className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] card-hover overflow-hidden"
            >
              <div
                className="absolute -top-12 -right-12 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
                style={{ background: m.color }}
              />
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 border"
                style={{
                  background: `${m.color}14`,
                  borderColor: `${m.color}33`,
                  color: m.color,
                }}
              >
                <m.icon size={20} />
              </div>
              <h3 className="text-base font-semibold text-zinc-100 mb-2">{m.label}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{m.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
