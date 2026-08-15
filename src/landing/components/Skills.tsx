import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Download, Copy, Check, ExternalLink, Compass } from 'lucide-react'
import { providerIcons } from './ProviderIcons'

type SkillCard = {
  id: string
  name: string
  author: string
  category: string
  description: string
  downloads: number
  sourceUrl: string
}

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

// Mirrors the app's registry IDs (src/services/SkillsMarketplace.ts) so an ID
// copied here pastes straight into GIA's Skills Marketplace search.
async function fetchCommunitySkills(): Promise<SkillCard[]> {
  const cards: SkillCard[] = []

  // 1. SkillsMP — community-published skills (same endpoint the app uses)
  try {
    const res = await fetch('https://skillsmp.com/api/v1/skills?limit=12&sort=trending', {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        skills?: Array<{ slug: string; name: string; description: string; author: string; category: string; downloads: number; tags?: string[] }>
      }
      for (const s of (data.skills || []).slice(0, 9)) {
        cards.push({
          id: `smp-${s.slug}`,
          name: s.name,
          author: s.author || 'Community',
          category: s.category || 'general',
          description: s.description,
          downloads: s.downloads || 0,
          sourceUrl: `https://skillsmp.com/skills/${s.slug}`,
        })
      }
    }
  } catch { /* registry unreachable — fall through */ }

  // 2. Anthropic's official skill collection
  if (cards.length < 3) {
    try {
      const res = await fetch('https://api.github.com/repos/anthropics/skills/contents/skills', {
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const items = (await res.json()) as Array<{ name: string; type: string }>
        const dirs = (items || []).filter((i) => i.type === 'dir').slice(0, 6)
        for (const dir of dirs) {
          const pretty = dir.name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          cards.push({
            id: `claude-${dir.name}`,
            name: pretty,
            author: 'Anthropic',
            category: 'Official',
            description: `Official Anthropic skill — ${pretty}. Loads full step-by-step instructions into GIA.`,
            downloads: 0,
            sourceUrl: `https://github.com/anthropics/skills/tree/main/skills/${dir.name}`,
          })
        }
      }
    } catch { /* registry unreachable — fall through */ }
  }

  return cards
}

function InstallButton({ skill }: { skill: SkillCard }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(skill.id)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = skill.id
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
        copied
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 hover:border-violet-500/40'
      }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Install in GIA'}
    </button>
  )
}

export function Skills() {
  const [skills, setSkills] = useState<SkillCard[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchCommunitySkills()
      .then((cards) => { if (!cancelled) setSkills(cards) })
      .catch(() => { /* fall through to empty */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const live = skills && skills.length > 0

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
            <Compass size={12} /> Community Skills
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            A growing <span className="gradient-text">skill ecosystem.</span>
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Live from the community registries — tap a skill, paste its ID into GIA's
            Skills Marketplace, and give GIA a new specialty in seconds.
          </p>
        </motion.div>

        {/* Live community skills */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
          </div>
        ) : live ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {skills!.map((skill, i) => (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 6) * 0.05 }}
                className="group flex flex-col gap-3 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-violet-500/30 hover:bg-violet-500/[0.03] transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center shrink-0">
                      <Download size={14} className="text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-200 truncate">{skill.name}</div>
                      <div className="text-[11px] text-zinc-600 truncate">
                        {skill.author}
                        {skill.downloads > 0 ? ` · ${skill.downloads.toLocaleString()} installs` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-zinc-500 uppercase tracking-wide shrink-0">
                    {skill.category}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{skill.description}</p>
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <InstallButton skill={skill} />
                  <a
                    href={skill.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    Source <ExternalLink size={10} />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        ) : null}

        {live && (
          <div className="text-center mb-16">
            <p className="text-xs text-zinc-600 mb-2">
              How it works: copy a skill ID → open GIA → Settings → Skills → paste to install &amp; activate.
            </p>
          </div>
        )}

        {/* Publish CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-24"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 px-8 py-6 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.06] to-transparent">
            <div className="text-left">
              <div className="text-sm font-semibold text-zinc-200 mb-1">Built a skill?</div>
              <div className="text-xs text-zinc-500">Publish it on SkillsMP and it shows up here and in GIA's marketplace automatically.</div>
            </div>
            <a
              href="https://skillsmp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition-all"
            >
              <ExternalLink size={12} />
              Publish a skill
            </a>
          </div>
        </motion.div>

        {/* Provider + tool ecosystem */}
        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-zinc-300 mb-2">Works with every major provider</h3>
          <p className="text-sm text-zinc-600">18+ AI providers · 200+ tool actions · one GIA</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-16">
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
