import { motion } from 'motion/react'
import { Github, ArrowRight, Smartphone } from 'lucide-react'

export function CTA() {
  return (
    <section className="relative py-32 overflow-hidden bg-[#050508]">
      <div className="absolute inset-0">
        <div className="hero-glow top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-violet-600 opacity-20" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-6 tracking-wider uppercase">
            Get Started
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Ready to Own{' '}
            <span className="gradient-text">Your AI?</span>
          </h2>

          <p className="text-lg text-zinc-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Download GIA and experience a truly private AI workspace.
            No sign-up. No cloud. No strings attached.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/alpha-1-design/gia-app/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-base font-semibold text-white shadow-2xl shadow-violet-500/25 transition-all duration-300"
            >
              <Smartphone size={18} />
              Download for Android
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="https://github.com/alpha-1-design/gia-app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-base font-medium text-zinc-400 hover:text-white transition-all"
            >
              <Github size={18} />
              Star on GitHub
            </a>
          </div>

          <p className="text-xs text-zinc-700 mt-6">
            No account needed. No data collection. Ever.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
