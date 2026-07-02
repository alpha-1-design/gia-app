import { motion } from 'motion/react'

const providers = [
  { name: 'OpenAI', short: 'GPT-4o', color: 'from-green-500/20 to-green-600/10' },
  { name: 'Anthropic', short: 'Claude', color: 'from-amber-500/20 to-amber-600/10' },
  { name: 'Google', short: 'Gemini', color: 'from-blue-500/20 to-blue-600/10' },
  { name: 'Mistral', short: 'Mistral', color: 'from-blue-400/20 to-blue-500/10' },
  { name: 'Groq', short: 'Groq', color: 'from-orange-500/20 to-orange-600/10' },
  { name: 'OpenRouter', short: 'OpenRouter', color: 'from-purple-500/20 to-purple-600/10' },
  { name: 'Local', short: 'Qwen 2.5', color: 'from-emerald-500/20 to-emerald-600/10' },
  { name: 'DeepSeek', short: 'DeepSeek', color: 'from-cyan-500/20 to-cyan-600/10' },
  { name: 'Together', short: 'Together', color: 'from-rose-500/20 to-rose-600/10' },
  { name: 'Azure', short: 'Azure', color: 'from-sky-500/20 to-sky-600/10' },
  { name: 'Perplexity', short: 'Perplexity', color: 'from-teal-500/20 to-teal-600/10' },
  { name: 'xAI', short: 'Grok', color: 'from-pink-500/20 to-pink-600/10' },
  { name: 'Cohere', short: 'Cohere', color: 'from-yellow-500/20 to-yellow-600/10' },
  { name: 'Fireworks', short: 'Fireworks', color: 'from-red-500/20 to-red-600/10' },
  { name: 'AI/ML API', short: 'AI/ML', color: 'from-indigo-500/20 to-indigo-600/10' },
  { name: 'NVIDIA', short: 'NVIDIA', color: 'from-emerald-500/20 to-emerald-600/10' },
  { name: 'Cerebras', short: 'Cerebras', color: 'from-violet-500/20 to-violet-600/10' },
  { name: 'GitHub', short: 'GitHub', color: 'from-gray-500/20 to-gray-600/10' },
]

const tools = [
  'Code Execution', 'File System', 'Terminal', 'SSH',
  'Web Browsing', 'Database', 'Network Scanning',
  'PDF Generation', 'Smart Home', 'MCP Servers',
  'Plugin System', 'Automation',
]

export function Skills() {
  return (
    <section id="skills" className="relative py-32 bg-[#050508]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            Ecosystem
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            18+ AI Providers.{' '}
            <span className="gradient-text">35+ Tool Actions.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Pick your preferred AI model. GIA works with every major provider.
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-3 mb-20">
          {providers.map((provider, i) => (
            <motion.div
              key={provider.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.02 }}
              className={`px-4 py-2 rounded-xl bg-gradient-to-br ${provider.color} border border-white/[0.04] text-sm font-medium text-zinc-300`}
            >
              {provider.short}
            </motion.div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-zinc-300 mb-2">Tool Ecosystem</h3>
          <p className="text-sm text-zinc-600">Extend GIA with powerful built-in tools</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {tools.map((tool, i) => (
            <motion.div
              key={tool}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.02 }}
              className="px-3.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] text-xs font-medium text-zinc-500"
            >
              {tool}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
