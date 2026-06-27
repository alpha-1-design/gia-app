import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Download, Key, MessageCircle, Smartphone, Github } from 'lucide-react';

const steps = [
  {
    step: 1,
    title: 'Clone the Repository',
    description: 'Get the code from GitHub — open source under Apache 2.0 license.',
    icon: <Github size={20} />,
    code: 'git clone https://github.com/alpha-1-design/gia-app.git',
    color: '#a855f7',
  },
  {
    step: 2,
    title: 'Install Dependencies',
    description: 'Install with a single command. No backend server, no database setup.',
    icon: <Download size={20} />,
    code: 'cd gia-app && npm ci --legacy-peer-deps',
    color: '#7c3aed',
  },
  {
    step: 3,
    title: 'Add Your API Key',
    description: 'Choose from 18+ providers (OpenAI, Anthropic, Gemini, Groq, local, etc.) and add your key in Settings.',
    icon: <Key size={20} />,
    code: 'npm run dev\n# then open Settings → Providers',
    color: '#3b82f6',
  },
  {
    step: 4,
    title: 'Start Chatting',
    description: 'That\'s it. You\'re ready to use your private, on-device AI workspace.',
    icon: <MessageCircle size={20} />,
    color: '#10b981',
  },
];

export const GettingStarted: React.FC = () => {
  return (
    <section id="getting-started" className="relative py-28 overflow-hidden bg-[#0a0a0f]">
      <div className="absolute inset-0">
        <div className="absolute top-[15%] right-[10%] w-[400px] h-[400px] bg-violet-600/4 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-semibold mb-4 tracking-widest uppercase">
            <Smartphone size={12} />
            Quick Start
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Up and Running in Minutes
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base">
            No cloud signup. No data collection. Just you and your AI.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative p-6 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-base font-bold"
                  style={{ background: `${step.color}15`, color: step.color }}
                >
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: `${step.color}20`, color: step.color }}
                    >
                      Step {step.step}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-[12px] text-zinc-500 mb-3">{step.description}</p>
                  {step.code && (
                    <div className="rounded-xl bg-black/40 border border-zinc-800/50 px-3.5 py-2.5 overflow-x-auto">
                      <code className="text-[11px] text-zinc-400 font-mono whitespace-nowrap">
                        <span className="text-zinc-600">$ </span>
                        {step.code}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <a
            href="https://github.com/alpha-1-design/gia-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-600/20 hover:shadow-violet-500/40"
          >
            <Github size={16} />
            View on GitHub
            <ArrowRight size={16} />
          </a>
          <p className="text-[11px] text-zinc-600 mt-4">Apache 2.0 License · No registration required</p>
        </motion.div>
      </div>
    </section>
  );
};