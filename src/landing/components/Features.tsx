import { motion } from 'motion/react'
import {
  Brain, Bot, MessageSquare, Search, FileText, Shield,
  Wifi, Smartphone, Camera, Zap, Globe, Workflow,
} from 'lucide-react'

const features = [
  { icon: Brain, title: 'Multi-Model AI', description: '18+ AI providers — OpenAI, Anthropic, Gemini, local LLMs. Switch freely, no lock-in.' },
  { icon: Bot, title: 'Autonomous Agents', description: 'Goal-driven agents that plan, execute, and adapt. Let AI handle complex multi-step tasks.' },
  { icon: MessageSquare, title: 'Smart Chat', description: 'Context-aware conversations with tool execution, file generation, and real-time streaming.' },
  { icon: Search, title: 'RAG & Memory', description: 'Vector search over your documents. Persistent memory that learns from every interaction.' },
  { icon: FileText, title: 'Document Generation', description: 'Create PDFs, reports, slides, and code — all within the app.' },
  { icon: Shield, title: 'Privacy First', description: 'No cloud backend. No telemetry. Your data stays on your device, always.' },
  { icon: Smartphone, title: 'Native Android', description: 'Built with Capacitor. Feels like a real app with native plugins for camera, SMS, and more.' },
  { icon: Camera, title: 'Visual Input', description: 'Capture photos, screenshots, and screen recordings. AI understands what it sees.' },
  { icon: Zap, title: 'Real-Time Streaming', description: 'Token-by-token streaming with thinking blocks, tool calls, and inline rendering.' },
  { icon: Globe, title: 'Web & API Tools', description: 'Browse the web, call APIs, SSH into servers — all from chat.' },
  { icon: Workflow, title: 'Custom Workflows', description: 'Build automation with plugins, MCP servers, and connector integrations.' },
  { icon: Wifi, title: 'Offline Mode', description: 'Local LLM support via Transformers WASM. No internet required for basic tasks.' },
]

export function Features() {
  return (
    <section id="features" className="relative py-32 bg-[#050508]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Everything You Need.{' '}
            <span className="gradient-text">Nothing You Don&apos;t.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            A complete AI workspace that respects your privacy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-violet-500/20 card-hover cursor-default"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/15 transition-colors">
                <feature.icon size={20} className="text-violet-400" />
              </div>
              <h3 className="text-base font-semibold text-zinc-200 mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
