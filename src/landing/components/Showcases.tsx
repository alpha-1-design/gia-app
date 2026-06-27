import React from 'react';
import { motion } from 'motion/react';
import {
  Brain, FileText, Image, Code2, Globe,
  Calendar, MessageSquare, Zap, Lock,
  Workflow, GitBranch, Sparkles,
  Palette, Cpu, Radio, Plug, PenLine,
} from 'lucide-react';

const showcaseGroups = [
  {
    title: 'Intelligence & Memory',
    items: [
      { icon: <Brain size={18} />, title: 'Agentic Loop', description: 'Multi-turn autonomous reasoning with sub-agent delegation, tool orchestration, and context-aware decision making.', color: '#a855f7' },
      { icon: <FileText size={18} />, title: 'Deep Memory', description: 'On-device persistent memory with relevance scoring, auto-extraction, pinning, categorization, and full CRUD tooling.', color: '#7c3aed' },
      { icon: <Workflow size={18} />, title: 'Custom Skills', description: 'Create role-based personas with tailored system prompts, tool access toggles, and personalized behavior rules.', color: '#8b5cf6' },
      { icon: <GitBranch size={18} />, title: 'Conversation Trees', description: 'Branch and fork conversations from any message. Full tree-based session management with visual branch explorer.', color: '#c084fc' },
    ],
  },
  {
    title: 'Content & Creation',
    items: [
      { icon: <Image size={18} />, title: 'Image Generation', description: 'DALL-E 3, Stable Diffusion, FLUX via OpenRouter. Plus local ONNX vision models for captioning, OCR, and detection.', color: '#ec4899' },
      { icon: <PenLine size={18} />, title: 'Document Generation', description: 'Generate PDF, DOCX, PPTX, and ZIP files from markdown. Preview inline or download with full file editing support.', color: '#f472b6' },
      { icon: <Palette size={18} />, title: 'Visual Blocks', description: 'Charts, data tables, mind maps, timelines, code diffs, image galleries — all rendered from AI-generated ```visual blocks.', color: '#d946ef' },
      { icon: <Code2 size={18} />, title: 'Code Execution', description: 'Run Python/JS/C++ via Piston API with auto-fix on error. Local Pyodide WASM runtime for offline execution.', color: '#10b981' },
    ],
  },
  {
    title: 'Connectivity & Integration',
    items: [
      { icon: <Globe size={18} />, title: 'Web Search & Browse', description: 'DuckDuckGo with formatted citations. Full browser automation via Node.js server for JS-rendered sites.', color: '#3b82f6' },
      { icon: <Calendar size={18} />, title: 'Calendar & Email', description: 'Full Google Calendar CRUD and Gmail integration via OAuth. Create, read, update, delete events and emails.', color: '#fb923c' },
      { icon: <MessageSquare size={18} />, title: 'Messaging Bridge', description: 'Telegram and WhatsApp integration with auto-reply, mention-only mode, and real-time message processing.', color: '#34d399' },
      { icon: <Radio size={18} />, title: 'Any-Endpoint Connections', description: 'Connect to any TCP/UDP endpoint. SSH into servers, query databases, WebSocket communication — all from chat.', color: '#22d3ee' },
    ],
  },
  {
    title: 'Platform & Control',
    items: [
      { icon: <Zap size={18} />, title: '18+ AI Providers', description: 'OpenAI, Anthropic, Gemini, Groq, OpenRouter, DeepSeek, Mistral, Perplexity, Ollama, LM Studio, local LLM, and more.', color: '#f59e0b' },
      { icon: <Plug size={18} />, title: 'MCP & Plugin System', description: 'Model Context Protocol (SSE/stdio) for tool extensibility. Hook-based plugin architecture with dynamic tool registration.', color: '#a855f7' },
      { icon: <Lock size={18} />, title: 'Zero Attack Surface', description: 'No HTTP server, no WebSocket server, no telemetry, no backend. Your data stays on your device. Period.', color: '#ef4444' },
      { icon: <Cpu size={18} />, title: 'On-Device AI', description: 'Local Qwen2.5 LLM (0.5B-3B), Whisper STT, vision models, and text classification — all running in-browser via WASM.', color: '#14b8a6' },
    ],
  },
];

export const Showcases: React.FC = () => {
  return (
    <section id="showcases" className="relative py-28 overflow-hidden bg-[#0d0d14]">
      <div className="absolute inset-0">
        <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] bg-purple-600/4 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-semibold mb-4 tracking-widest uppercase">
            <Sparkles size={12} />
            Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything You Need, Nothing You Don&apos;t
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base">
            Over 35 tool actions across 8 modules — from autonomous agents to local AI models,
            all running on your device with zero cloud dependency.
          </p>
        </motion.div>

        {showcaseGroups.map((group, gi) => (
          <div key={group.title} className="mb-14 last:mb-0">
            <motion.h3
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-lg font-semibold text-zinc-300 mb-5 flex items-center gap-2"
            >
              <span className="w-6 h-[2px] rounded-full bg-violet-500/50" />
              {group.title}
            </motion.h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {group.items.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 + gi * 0.08 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="group relative p-5 rounded-2xl transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(500px circle at 50% 0%, ${item.color}08, transparent 60%)`,
                    }}
                  />
                  <div className="relative z-10">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: `${item.color}12`, color: item.color }}
                    >
                      {item.icon}
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
                    <p className="text-[11.5px] text-zinc-500 leading-relaxed">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="rounded-2xl p-8 sm:p-10 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.06) 0%, rgba(124,58,237,0.04) 100%)',
            border: '1px solid rgba(168,85,247,0.1)',
          }}
        >
          <h3 className="text-xl font-bold text-white mb-2">
            And So Much More
          </h3>
          <p className="text-zinc-400 text-sm">
            Wake word detection · Voice overlay · Biometric lock · Screen capture · Social media manager ·
            API gateway · Gateway daemon · Scheduler · Notes · Tasks · Knowledge manager · Engine Room · 
            Brain backup · PWA · Deep links · Circle-to-search · Plugin system · Long-running mode
          </p>
        </motion.div>
      </div>
    </section>
  );
};
