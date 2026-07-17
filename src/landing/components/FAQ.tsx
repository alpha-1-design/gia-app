import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'Do I need an API key to use GIA?',
    a: 'For cloud models (OpenAI, Anthropic, Gemini, and 15+ others) you bring your own key — GIA never stores it on a server. But you can also run GIA fully on-device with the local LLM and need no key at all.',
  },
  {
    q: 'Is my data actually private?',
    a: 'Yes. There is no GIA cloud backend and no telemetry. In On-Device Mode, memory, embeddings, and translation all run locally on your phone. Cloud models are a toggle you switch on — never a silent default.',
  },
  {
    q: 'Does it work offline?',
    a: 'The personal layer does: local LLM (Transformers WASM), on-device embeddings/RAG, and memory all work with no internet. Heavy reasoning and web tools need a connection, which is why every response is tagged on-device or cloud.',
  },
  {
    q: 'Which models and providers are supported?',
    a: '18+ providers including OpenAI, Anthropic, Gemini, Mistral, Groq, DeepSeek, Cohere, Perplexity, xAI, Together, Azure, and more — plus local models. Switch freely, no lock-in.',
  },
  {
    q: 'What platforms does GIA run on?',
    a: 'Native Android via Capacitor (sideload the APK), and a full Web app. Native plugins give it camera, SMS, storage, and device health on mobile.',
  },
  {
    q: 'Is GIA free?',
    a: 'GIA itself is open source. You only pay a provider if you choose to use their cloud models; the on-device path costs nothing.',
  },
]

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm sm:text-base font-medium text-zinc-200">{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} className="shrink-0">
          <ChevronDown size={16} className="text-violet-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30, opacity: { duration: 0.18 } }}
            style={{ overflow: 'hidden' }}
          >
            <p className="px-5 pb-5 text-sm text-zinc-500 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FAQ() {
  return (
    <section id="faq" className="relative py-32 bg-[#050508]">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Questions, <span className="gradient-text">answered.</span>
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((f) => (
            <FaqRow key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  )
}
