import React from 'react';
import { motion } from 'motion/react';
import {
  Cloud, Database, Globe, Mail, MessageCircle, Github,
  Zap, Lock, Plug, Server, Wifi, Cpu
} from 'lucide-react';

const connectors = [
  { name: 'OpenAI', icon: <Zap size={14} />, color: '#10a37f', type: 'Cloud' },
  { name: 'Anthropic', icon: <Zap size={14} />, color: '#d4a574', type: 'Cloud' },
  { name: 'Google Gemini', icon: <Globe size={14} />, color: '#4285f4', type: 'Cloud' },
  { name: 'GitHub', icon: <Github size={14} />, color: '#ffffff', type: 'Tool' },
  { name: 'OpenRouter', icon: <Zap size={14} />, color: '#ff6b35', type: 'Cloud' },
  { name: 'Groq', icon: <Zap size={14} />, color: '#f97316', type: 'Cloud' },
  { name: 'Ollama', icon: <Database size={14} />, color: '#7c3aed', type: 'Local' },
  { name: 'LM Studio', icon: <Server size={14} />, color: '#3ecf8e', type: 'Local' },
  { name: 'Supabase', icon: <Database size={14} />, color: '#3ecf8e', type: 'Tool' },
  { name: 'PostgreSQL', icon: <Database size={14} />, color: '#336791', type: 'Tool' },
  { name: 'MySQL', icon: <Database size={14} />, color: '#4479a1', type: 'Tool' },
  { name: 'SQLite', icon: <Database size={14} />, color: '#003b57', type: 'Tool' },
  { name: 'Twilio', icon: <MessageCircle size={14} />, color: '#f22f46', type: 'Tool' },
  { name: 'Gmail', icon: <Mail size={14} />, color: '#ea4335', type: 'Tool' },
  { name: 'Google Calendar', icon: <Zap size={14} />, color: '#4285f4', type: 'Tool' },
  { name: 'Telegram', icon: <Send size={12} />, color: '#26a5e4', type: 'Tool' },
  { name: 'WhatsApp', icon: <MessageCircle size={14} />, color: '#25d366', type: 'Tool' },
  { name: 'DuckDuckGo', icon: <Globe size={14} />, color: '#de5833', type: 'Tool' },
  { name: 'DeepSeek', icon: <Zap size={14} />, color: '#4f6bf5', type: 'Cloud' },
  { name: 'Mistral AI', icon: <Zap size={14} />, color: '#ff7000', type: 'Cloud' },
  { name: 'Fireworks AI', icon: <Zap size={14} />, color: '#ff3366', type: 'Cloud' },
  { name: 'Perplexity', icon: <Zap size={14} />, color: '#1a9fff', type: 'Cloud' },
  { name: 'Cohere', icon: <Zap size={14} />, color: '#39594d', type: 'Cloud' },
  { name: 'Cloudflare', icon: <Cloud size={14} />, color: '#f38020', type: 'Tool' },
  { name: 'HuggingFace', icon: <Zap size={14} />, color: '#fbbf24', type: 'Cloud' },
  { name: 'NVIDIA NIM', icon: <Cpu size={14} />, color: '#76b900', type: 'Cloud' },
  { name: 'Together AI', icon: <Zap size={14} />, color: '#8b5cf6', type: 'Cloud' },
  { name: 'Cerebras', icon: <Zap size={14} />, color: '#06b6d4', type: 'Cloud' },
  { name: 'DeepInfra', icon: <Zap size={14} />, color: '#f43f5e', type: 'Cloud' },
  { name: 'xAI Grok', icon: <Zap size={14} />, color: '#1da1f2', type: 'Cloud' },
  { name: 'AI21 Labs', icon: <Zap size={14} />, color: '#ec4899', type: 'Cloud' },
  { name: 'Replicate', icon: <Zap size={14} />, color: '#6366f1', type: 'Cloud' },
  { name: 'OpenCode Zen', icon: <Zap size={14} />, color: '#f59e0b', type: 'Cloud' },
  { name: 'Local Qwen2.5', icon: <Cpu size={14} />, color: '#14b8a6', type: 'Local' },
  { name: 'Local Whisper', icon: <Cpu size={14} />, color: '#06b6d4', type: 'Local' },
  { name: 'Local Vision', icon: <Eye size={14} />, color: '#a855f7', type: 'Local' },
  { name: 'MCP Servers', icon: <Plug size={14} />, color: '#a855f7', type: 'Tool' },
  { name: 'WebSocket', icon: <Wifi size={14} />, color: '#22d3ee', type: 'Tool' },
  { name: 'SSH/TCP', icon: <Server size={14} />, color: '#f59e0b', type: 'Tool' },
  { name: 'WebDAV', icon: <Cloud size={14} />, color: '#64748b', type: 'Tool' },
  { name: 'S3 Backup', icon: <Cloud size={14} />, color: '#f97316', type: 'Tool' },
];

import { Send, Eye } from 'lucide-react';

export const Connectors: React.FC = () => {
  return (
    <section className="relative py-28 overflow-hidden bg-[#0d0d14]">
      <div className="absolute inset-0">
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-violet-600/4 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-semibold mb-4 tracking-widest uppercase">
            <Plug size={12} />
            Ecosystem
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            40+ Connectors & Providers
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base">
            GIA connects directly to the services you already use — no proxy, no middleman.
            Plus local models, MCP servers, and raw TCP/UDP connectivity for anything else.
          </p>
        </motion.div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-2.5">
          {connectors.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 8) * 0.02 }}
              whileHover={{ y: -3, scale: 1.04 }}
              className="group relative flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-default transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
                style={{ background: `${c.color}10`, color: c.color }}
              >
                {c.icon}
              </div>
              <span className="text-[8px] text-zinc-600 font-medium text-center leading-tight group-hover:text-zinc-400 transition-colors">
                {c.name}
              </span>
              <span
                className="text-[7px] font-semibold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: c.type === 'Cloud' ? 'rgba(59,130,246,0.15)' : c.type === 'Local' ? 'rgba(16,185,129,0.15)' : 'rgba(168,85,247,0.15)',
                  color: c.type === 'Cloud' ? '#60a5fa' : c.type === 'Local' ? '#34d399' : '#c084fc',
                }}
              >
                {c.type}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-4 mt-12"
        >
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-blue-500/50" />
            Cloud Providers
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
            Local / On-Device
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-violet-500/50" />
            Tools & Services
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-700 ml-2">
            <Lock size={10} />
            All connections are direct HTTPS — no proxy, no telemetry
          </div>
        </motion.div>
      </div>
    </section>
  );
};
