import { motion } from 'motion/react'
import { Check, X } from 'lucide-react'

const rows = [
  { feature: 'Runs on your device', gia: true, other: false },
  { feature: 'No account, no telemetry', gia: true, other: false },
  { feature: 'Works fully offline', gia: true, other: false },
  { feature: 'Bring your own API key (18+ providers)', gia: true, other: 'partial' as const },
  { feature: 'Persistent personal memory', gia: true, other: false },
  { feature: 'Autonomous agents + tool loop', gia: true, other: 'partial' as const },
  { feature: 'Open source', gia: true, other: false },
  { feature: 'Cloud when you want it', gia: true, other: true },
]

function Cell({ value }: { value: boolean | 'partial' }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400">
        <Check size={13} />
      </span>
    )
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 text-amber-400">
        <Check size={13} />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-500/10 text-zinc-600">
      <X size={13} />
    </span>
  )
}

export function Comparison() {
  return (
    <section id="compare" className="relative py-32 bg-[#050508]">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            The Difference
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            GIA vs the <span className="gradient-text">typical assistant.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Most assistants are a chat box wired to someone else&apos;s cloud. GIA is a workspace that lives with you.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-4 border-b border-white/[0.06]">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Capability</span>
            <span className="text-sm font-semibold text-violet-400 text-center w-28">GIA</span>
            <span className="text-sm font-semibold text-zinc-500 text-center w-28">Cloud-only</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.feature}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-3.5 border-b border-white/[0.04] last:border-0"
            >
              <span className="text-sm text-zinc-300">{r.feature}</span>
              <div className="flex justify-center w-28"><Cell value={r.gia} /></div>
              <div className="flex justify-center w-28"><Cell value={r.other} /></div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
