import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Rocket, MessageSquare, GraduationCap, BarChart3, PenLine,
  ListTodo, Bot, Target, Cpu, ShieldCheck, BookOpen, Wrench, Sparkles, AudioLines,
} from 'lucide-react'

type DocSection = {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  blocks: { type: 'p' | 'ul'; text?: string; items?: string[] }[]
}

type RawSection = {
  id: string
  title: string
  blocks: { type: 'p' | 'ul'; text?: string; items?: string[] }[]
}

// Embedded fallback — shown only if the machine-readable docs can't be fetched.
// The canonical, richer version lives in public/docs/gia-docs.json and is the
// same file GIA fetches from her system prompt.
const fallbackSections: DocSection[] = [
  {
    id: 'start', icon: Rocket, title: 'Getting Started',
    blocks: [
      { type: 'p', text: 'GIA is a private AI workspace that runs on your Android device or in the browser. There is no account to create and no cloud backend.' },
      { type: 'p', text: 'To use cloud models, open Settings → Engine Room and connect a provider with your own API key. To go fully on-device, enable On-Device Mode and load a local model in Settings → Local LLM.' },
      { type: 'ul', items: [
        'Download the APK from GitHub Releases (Android) or open the Web app.',
        'Connect a provider, or enable On-Device Mode for zero-key use.',
        'Start chatting — GIA remembers what you tell it across modules.',
      ] },
    ],
  },
  {
    id: 'chat', icon: MessageSquare, title: 'Chat',
    blocks: [
      { type: 'p', text: 'The core workspace. Talk to GIA with tools, files, memory, and real-time streaming.' },
      { type: 'ul', items: [
        'Attach files, images, or share from another app.',
        'GIA streams responses token-by-token and runs tools in a loop.',
        'Every response is tagged on-device or cloud so you always know where it ran.',
      ] },
    ],
  },
  {
    id: 'exam', icon: GraduationCap, title: 'Exam',
    blocks: [
      { type: 'p', text: 'Built for students. Generate WASSCE and BECE quizzes, walk through past questions, and get instant feedback.' },
    ],
  },
  {
    id: 'analyst', icon: BarChart3, title: 'Analyst',
    blocks: [
      { type: 'p', text: 'Turn raw data into clear, structured insight with charts and JSON-ready analysis.' },
    ],
  },
  {
    id: 'writer', icon: PenLine, title: 'Writer',
    blocks: [
      { type: 'p', text: 'Long-form and visual content — drafts, documents, slides, and code — generated and rendered inline.' },
    ],
  },
  {
    id: 'planner', icon: ListTodo, title: 'Planner',
    blocks: [
      { type: 'p', text: 'Break big goals into calm, actionable steps — a study week, a project plan, or a personal roadmap.' },
    ],
  },
  {
    id: 'agents', icon: Bot, title: 'Agents',
    blocks: [
      { type: 'p', text: 'Build autonomous agents with their own memory and RAG. Delegate work and oversee the result.' },
    ],
  },
  {
    id: 'ondevice', icon: Cpu, title: 'On-Device Mode',
    blocks: [
      { type: 'p', text: 'On-Device Mode prefers the local LLM for every response when a model is loaded. Memory, embeddings, and translation run locally — nothing leaves your device.' },
    ],
  },
  {
    id: 'privacy', icon: ShieldCheck, title: 'Privacy & Security',
    blocks: [
      { type: 'p', text: 'GIA has no cloud backend and no telemetry. Your data stays on your device unless you explicitly choose a cloud model.' },
    ],
  },
]

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  start: Rocket,
  modules: Target,
  chat: MessageSquare,
  writer: PenLine,
  planner: ListTodo,
  exam: GraduationCap,
  analyst: BarChart3,
  agents: Bot,
  autonomy: Target,
  tools: Wrench,
  skills: Sparkles,
  voice: AudioLines,
  terminal: Wrench,
  providers: Cpu,
  memory: Sparkles,
  shortcuts: MessageSquare,
  settings: Target,
  mcp: Wrench,
  ondevice: Cpu,
  privacy: ShieldCheck,
  connectors: Target,
  troubleshooting: BookOpen,
  advanced: Sparkles,
}

export function Docs() {
  const [fetched, setFetched] = useState<RawSection[] | null>(null)
  const [active, setActive] = useState('start')

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}docs/gia-docs.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('docs fetch failed'))))
      .then((data: { sections?: RawSection[] }) => {
        if (!cancelled && Array.isArray(data?.sections) && data.sections.length > 0) {
          setFetched(data.sections)
        }
      })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [])

  const sections: DocSection[] = fetched
    ? fetched.map((s) => ({ ...s, icon: ICONS[s.id] ?? BookOpen }))
    : fallbackSections

  const current = sections.find((s) => s.id === active) ?? sections[0]

  return (
    <section id="docs" className="relative py-32 bg-[#050508]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            <BookOpen size={12} /> Documentation
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Everything you need to <span className="gradient-text">run GIA.</span>
          </h2>
          <p className="text-sm text-zinc-500 max-w-2xl mx-auto">
            These docs are machine-readable — GIA reads the very same page from her knowledge base
            when she's unsure about a feature, so the answers you see here are the answers she gives.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
          <nav className="md:sticky md:top-24 self-start space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
                  active === s.id ? 'bg-violet-500/10 text-violet-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                }`}
              >
                <s.icon size={15} />
                {s.title}
              </button>
            ))}
          </nav>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 min-h-[320px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/10 flex items-center justify-center">
                    <current.icon size={18} className="text-violet-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-100">{current.title}</h3>
                </div>
                {current.blocks.map((b, i) =>
                  b.type === 'p' ? (
                    <p key={i} className="text-sm text-zinc-400 leading-relaxed mb-4">{b.text}</p>
                  ) : (
                    <ul key={i} className="space-y-2 mb-4">
                      {b.items?.map((it) => (
                        <li key={it} className="flex items-start gap-2 text-sm text-zinc-400 leading-relaxed">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-violet-400" />
                          {it}
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
