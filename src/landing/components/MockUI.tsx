import React from 'react';
import { motion } from 'motion/react';
import {
  MessageCircle, BarChart2, GraduationCap, PenLine, ListTodo,
  Settings, Target, Bot, Send, Sparkles, ChevronDown, Wifi, Monitor, Mic
} from 'lucide-react';

const modules = [
  { id: 'chat', icon: <MessageCircle size={13} />, label: 'Chat', color: '#a855f7' },
  { id: 'exam', icon: <GraduationCap size={13} />, label: 'Exam', color: '#f59e0b' },
  { id: 'analyst', icon: <BarChart2 size={13} />, label: 'Analyst', color: '#3b82f6' },
  { id: 'writer', icon: <PenLine size={13} />, label: 'Writer', color: '#ec4899' },
  { id: 'planner', icon: <ListTodo size={13} />, label: 'Planner', color: '#10b981' },
  { id: 'agents', icon: <Bot size={13} />, label: 'Agents', color: '#a855f7' },
  { id: 'autonomy', icon: <Target size={13} />, label: 'Autonomy', color: '#34d399' },
  { id: 'settings', icon: <Settings size={13} />, label: 'Settings', color: '#94a3b8' },
];

const mockMessages = [
  { role: 'user', text: 'Analyze this sales data and create a forecast for Q3 2026' },
  { role: 'assistant', text: 'I\'ve analyzed 2 years of sales data. Here\'s the Q3 forecast with a projected 18.4% growth.', type: 'chart' },
  { role: 'user', text: 'Great! Can you write a summary report and schedule a meeting to discuss it?' },
  { role: 'assistant', text: 'Generating a comprehensive report with key drivers, risks, and recommendations. Also checking your calendar...', type: 'writing' },
];

export const MockUI: React.FC = () => {
  return (
    <section className="relative py-28 overflow-hidden bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-semibold mb-4 tracking-widest uppercase">
            <Monitor size={12} />
            Interface
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Designed for Deep Focus
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base">
            A dark, refined interface with eight integrated modules — each with its own accent personality.
            Minimal, fast, and beautiful.
          </p>
        </motion.div>

        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative max-w-[340px] mx-auto"
          >
            <div className="relative rounded-[3.2rem] bg-gradient-to-b from-zinc-800 to-zinc-900 p-[3px] shadow-2xl shadow-violet-900/20">
              <div className="rounded-[3rem] bg-[#0a0a0f] p-3 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-[18px] bg-zinc-900 rounded-b-xl z-20" />

                <div className="rounded-[2.4rem] overflow-hidden bg-[#0d0d14]">
                  <div className="flex items-center justify-between px-5 pt-9 pb-1.5 text-[10px] text-zinc-600">
                    <span className="font-semibold">9:41</span>
                    <div className="flex items-center gap-1">
                      <Wifi size={10} />
                      <div className="w-[14px] h-2 rounded-sm border border-zinc-700 relative">
                        <div className="absolute inset-[1.5px] rounded-sm bg-zinc-600 w-[60%]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3.5 py-1.5">
                    <div className="flex items-center gap-2.5">
                      <h1 className="text-base font-bold text-white tracking-tight">GIA</h1>
                      <button
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{
                          background: 'rgba(168,85,247,0.12)',
                          color: '#a855f7',
                          border: '1px solid rgba(168,85,247,0.2)',
                        }}
                      >
                        <MessageCircle size={10} />
                        <span className="hidden xs:inline">Chat</span>
                        <ChevronDown size={9} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-violet-600/30">
                        G
                      </div>
                    </div>
                  </div>

                  <div className="px-3.5 py-2 space-y-3 min-h-[340px]">
                    {mockMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.25 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-br-[4px]'
                              : 'bg-zinc-800/60 text-zinc-200 rounded-bl-[4px] border border-zinc-700/40 backdrop-blur-sm'
                          }`}
                        >
                          <p className="text-[11.5px] leading-relaxed">{msg.text}</p>
                          {msg.type === 'chart' && (
                            <div className="mt-2.5 rounded-xl bg-violet-500/8 border border-violet-500/15 p-2.5">
                              <div className="flex items-end gap-1 h-12">
                                {[35, 48, 42, 55, 60, 45, 72].map((h, j) => (
                                  <motion.div
                                    key={j}
                                    initial={{ height: 0 }}
                                    whileInView={{ height: `${h}%` }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 1 + j * 0.05, duration: 0.4 }}
                                    className="flex-1 rounded-sm bg-gradient-to-t from-violet-600 to-violet-400"
                                  />
                                ))}
                              </div>
                              <div className="flex justify-between mt-1.5 text-[8px] text-violet-400/60">
                                <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span>
                              </div>
                            </div>
                          )}
                          {msg.type === 'writing' && (
                            <div className="mt-2 flex items-center gap-1.5 text-violet-400">
                              <div className="flex items-center gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                              <span className="text-[9px] font-medium">Generating report...</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="px-3.5 pb-3.5 pt-1">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800/60">
                      <input
                        type="text"
                        placeholder="Ask GIA anything..."
                        className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
                        readOnly
                      />
                      <button className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors shadow-sm shadow-violet-600/30">
                        <Send size={10} className="text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block absolute -right-28 top-[10%] space-y-2">
              {modules.slice(0, 4).map((mod, i) => (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, x: 15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.06 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-semibold backdrop-blur-md"
                  style={{
                    background: 'rgba(18,18,24,0.9)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: mod.color,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                >
                  {mod.icon}
                  <span>{mod.label}</span>
                </motion.div>
              ))}
            </div>
            <div className="hidden lg:block absolute -left-28 top-[30%] space-y-2">
              {modules.slice(4).map((mod, i) => (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.06 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-semibold backdrop-blur-md"
                  style={{
                    background: 'rgba(18,18,24,0.9)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: mod.color,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                >
                  {mod.icon}
                  <span>{mod.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/30 border border-zinc-700/20">
            <Mic size={11} className="text-zinc-500" />
            <span className="text-[10px] text-zinc-500">
              Voice input · Wake word · 8 modules · Streaming responses · Live thinking panel
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
