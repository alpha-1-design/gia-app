import { motion } from 'motion/react'
import { providerIcons } from './ProviderIcons'

const providers = [
  'OpenAI', 'Anthropic', 'Gemini', 'Mistral',
  'Groq', 'DeepSeek', 'Cohere', 'Perplexity',
  'xAI', 'Together', 'Azure', 'Fireworks',
  'NVIDIA', 'Cerebras', 'OpenRouter', 'AI/ML',
  'Local', 'GitHub',
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
          {providers.map((name, i) => {
            const icon = providerIcons[name]
            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.025 }}
                className="group flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all duration-300 cursor-default"
                style={{
                  background: `${icon?.color || '#6b7280'}08`,
                  borderColor: `${icon?.color || '#6b7280'}15`,
                }}
                whileHover={{
                  scale: 1.05,
                  background: `${icon?.color || '#6b7280'}15`,
                  borderColor: `${icon?.color || '#6b7280'}30`,
                  transition: { duration: 0.15 },
                }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300"
                  style={{ background: `${icon?.color || '#6b7280'}20` }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={icon?.color || '#6b7280'}>
                    <path d={icon?.path || 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'} />
                  </svg>
                </div>
                <span className="text-sm font-medium transition-colors duration-300" style={{ color: `${icon?.color || '#888'}bb` }}>
                  {name === 'AI/ML' ? 'AI/ML API' : name}
                </span>
              </motion.div>
            )
          })}
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
