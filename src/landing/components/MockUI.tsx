import { useState, useEffect, useRef } from 'react'

type ModuleId = 'chat' | 'analyst' | 'exam' | 'writer' | 'planner'

interface Scene {
  module: ModuleId
  userInput: string
  thinkPhases: string[]
  render: (phase: string) => React.ReactNode
}

const codeSnip = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n-1) + fibonacci(n-2);
}`

const scenes: Scene[] = [
  {
    module: 'chat',
    userInput: 'Write a Fibonacci function in TypeScript',
    thinkPhases: ['Analyzing request…', 'Generating code…', 'Optimizing solution…'],
    render: (phase) => (
      <div className="space-y-2.5">
        <div className="flex flex-row-reverse items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div className="p-2.5 rounded-[16px_16px_4px_16px] bg-violet-600/10 border border-violet-500/20 text-xs text-zinc-200 max-w-[78%]">
            Write a Fibonacci function in TypeScript
          </div>
        </div>

        {phase !== 'done' ? (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111118] border border-white/[0.05]">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }} />
                ))}
              </div>
              <span className="text-[10px] text-zinc-600 font-medium">{phase}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="p-2.5 rounded-[4px_16px_16px_16px] bg-[#111118] border border-white/[0.05] max-w-[78%]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[9px] text-zinc-600 font-medium">GIA</span>
                <span className="text-[8px] text-zinc-700">via Claude 3.5 Sonnet</span>
                <span className="text-[8px] text-emerald-500/60 px-1 rounded-full bg-emerald-500/10">0.8s</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-2">Here's a Fibonacci implementation in TypeScript:</p>
              <div className="rounded-lg overflow-hidden border border-white/[0.04]">
                <div className="flex items-center justify-between px-2.5 py-1 bg-[#18181f] border-b border-white/[0.04]">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500/30" />
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/30" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30" />
                  </div>
                  <span className="text-[8px] text-zinc-700 font-mono">fibonacci.ts</span>
                </div>
                <pre className="px-2.5 py-2 text-[9px] font-mono leading-relaxed text-zinc-600 bg-[#0a0a0f] whitespace-pre overflow-x-auto">{codeSnip}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    ),
  },
  {
    module: 'analyst',
    userInput: 'Analyze this quarter revenue data',
    thinkPhases: ['Parsing CSV (36 rows)…', 'Computing trends…', 'Generating visualization…'],
    render: (phase) => (
      <div className="space-y-2.5">
        <div className="flex flex-row-reverse items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div className="p-2.5 rounded-[16px_16px_4px_16px] bg-violet-600/10 border border-violet-500/20 text-xs text-zinc-200 max-w-[78%]">
            Analyze this quarter revenue data
          </div>
        </div>

        {phase !== 'done' && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111118] border border-white/[0.05]">
              <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              <span className="text-[10px] text-zinc-600 font-medium">{phase}</span>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="p-2.5 rounded-[4px_16px_16px_16px] bg-[#111118] border border-white/[0.05] w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-zinc-400 font-medium">Monthly Revenue — Q3 2026</span>
                <div className="flex gap-1">
                  {['W', 'M', 'Y'].map(l => (
                    <span key={l} className="text-[7px] px-1.5 py-0.5 rounded" style={{ background: l === 'M' ? 'rgba(59,130,246,0.15)' : 'transparent', color: l === 'M' ? '#60a5fa' : '#4a4a5a' }}>{l}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-1 h-20 px-1">
                {[35, 55, 40, 70, 45, 60, 50, 75, 38, 58, 42, 65].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm animate-slide-up" style={{
                    height: `${h}%`,
                    background: `linear-gradient(to top, rgba(59,130,246,0.35), rgba(59,130,246,0.1))`,
                    borderTop: '1px solid rgba(59,130,246,0.2)',
                    animationDelay: `${i * 0.03}s`,
                    animationDuration: '0.5s',
                    animationFillMode: 'both',
                  }} />
                ))}
              </div>
              <div className="flex justify-between text-[7px] text-zinc-700 mt-1 px-1">
                <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
              </div>
              <div className="mt-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="text-[9px] text-blue-400 font-semibold mb-0.5">Key Insight</div>
                <div className="text-[8px] text-zinc-500 leading-relaxed">Revenue grew 23.4% QoQ. Enterprise segment drove 68% of growth.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    ),
  },
  {
    module: 'exam',
    userInput: 'Quiz me on data structures',
    thinkPhases: ['Generating questions…', 'Adapting difficulty…', 'Ready!'],
    render: (phase) => (
      <div className="space-y-2.5">
        <div className="flex flex-row-reverse items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div className="p-2.5 rounded-[16px_16px_4px_16px] bg-violet-600/10 border border-violet-500/20 text-xs text-zinc-200 max-w-[78%]">
            Quiz me on data structures
          </div>
        </div>

        {phase !== 'done' && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111118] border border-white/[0.05]">
              <div className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{
                    background: `rgba(245,158,11,${0.6 - i * 0.15})`,
                    animationDelay: `${i * 0.2}s`,
                  }}>
                    <div className="w-full h-full rounded-full border-2 border-amber-400/30 border-t-transparent animate-spin" style={{ animationDuration: '0.8s' }} />
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-zinc-600 font-medium">{phase}</span>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="p-2.5 rounded-[4px_16px_16px_16px] bg-[#111118] border border-white/[0.05] w-full">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 animate-pulse" />
                <span className="text-[9px] text-amber-500/80 font-semibold tracking-wider uppercase">Flashcard</span>
                <span className="text-[8px] text-zinc-700 ml-auto">1 of 4</span>
              </div>
              <p className="text-[11px] text-zinc-300 mb-2.5 leading-relaxed">What data structure uses LIFO (Last In, First Out) ordering?</p>
              <div className="space-y-1">
                {['Queue', 'Stack', 'Tree', 'Hash Map'].map((opt, i) => (
                  <div key={i} className="px-2.5 py-1.5 rounded-lg text-[9px]" style={{
                    background: i === 1 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                    border: i === 1 ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.04)',
                    color: i === 1 ? '#fbbf24' : '#5a5a70',
                  }}>
                    {opt}
                    {i === 1 && <svg className="inline ml-1.5" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    ),
  },
  {
    module: 'writer',
    userInput: 'Draft a blog post about local AI',
    thinkPhases: ['Researching topic…', 'Outlining structure…', 'Crafting draft…'],
    render: (phase) => (
      <div className="space-y-2.5">
        <div className="flex flex-row-reverse items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div className="p-2.5 rounded-[16px_16px_4px_16px] bg-violet-600/10 border border-violet-500/20 text-xs text-zinc-200 max-w-[78%]">
            Draft a blog post about local AI
          </div>
        </div>

        {phase !== 'done' && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111118] border border-white/[0.05]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" className="animate-pulse"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              <span className="text-[10px] text-zinc-600 font-medium">{phase}</span>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="p-2.5 rounded-[4px_16px_16px_16px] bg-[#111118] border border-white/[0.05] w-full">
              <div className="flex items-center gap-2 mb-2">
                {['Draft', 'Edit', 'Review', 'Polish'].map((s, i) => (
                  <div key={i} className="text-[7px] px-2 py-0.5 rounded-full" style={{
                    background: i === 0 ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.03)',
                    color: i === 0 ? '#ec4899' : '#4a4a5a',
                    border: i === 0 ? '1px solid rgba(236,72,153,0.2)' : '1px solid rgba(255,255,255,0.04)',
                  }}>{s}</div>
                ))}
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#5a5a70" strokeWidth="2" className="ml-auto"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </div>
              <h4 className="text-[11px] text-zinc-200 font-semibold mb-1">The Rise of Local AI</h4>
              <p className="text-[9px] text-zinc-600 leading-relaxed line-clamp-4">
                As large language models continue to evolve, the line between cloud-based and on-device AI is blurring. With advances in quantization and efficient architectures, running capable models locally is no longer a futuristic concept — it's here today. In this post, we explore how local AI is reshaping privacy, latency, and user autonomy in ways that centralized solutions simply cannot match.
              </p>
              <div className="flex gap-1 mt-2">
                {[45, 65, 35, 55, 40].map((w, i) => (
                  <div key={i} className="h-1 rounded-full bg-pink-500/10" style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[7px] text-zinc-700">
                <span>342 words</span>
                <span>87% readability</span>
                <span>Grade 8 level</span>
              </div>
            </div>
          </div>
        )}
      </div>
    ),
  },
  {
    module: 'planner',
    userInput: 'Plan my engineering sprint',
    thinkPhases: ['Reviewing priorities…', 'Scheduling tasks…', 'Optimizing timeline…'],
    render: (phase) => (
      <div className="space-y-2.5">
        <div className="flex flex-row-reverse items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div className="p-2.5 rounded-[16px_16px_4px_16px] bg-violet-600/10 border border-violet-500/20 text-xs text-zinc-200 max-w-[78%]">
            Plan my engineering sprint
          </div>
        </div>

        {phase !== 'done' && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111118] border border-white/[0.05]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" className="animate-spin" style={{ animationDuration: '2s' }}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <span className="text-[10px] text-zinc-600 font-medium">{phase}</span>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#18181f] border border-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#8888a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div className="p-2.5 rounded-[4px_16px_16px_16px] bg-[#111118] border border-white/[0.05] w-full">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/30 animate-pulse" />
                <span className="text-[9px] text-emerald-400/80 font-semibold tracking-wider uppercase">Sprint Plan</span>
                <span className="text-[8px] text-zinc-700 ml-auto">2 weeks</span>
              </div>
              <div className="space-y-1">
                {[
                  { task: 'Complete Q3 report', tag: 'P0', done: true },
                  { task: 'API rate limiting', tag: 'P0', done: true },
                  { task: 'Write integration tests', tag: 'P1', done: false },
                  { task: 'Update documentation', tag: 'P2', done: false },
                  { task: 'Performance audit', tag: 'P1', done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{
                    background: item.done ? 'rgba(16,185,129,0.05)' : 'transparent',
                  }}>
                    <div className="w-3 h-3 rounded flex items-center justify-center shrink-0" style={{
                      background: item.done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
                      border: item.done ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                      {item.done && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span className="text-[9px]" style={{
                      color: item.done ? '#5a5a70' : '#a0a0b8',
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}>{item.task}</span>
                    <span className="ml-auto text-[7px] px-1 py-0.5 rounded font-bold" style={{
                      background: item.tag === 'P0' ? 'rgba(239,68,68,0.15)' : item.tag === 'P1' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                      color: item.tag === 'P0' ? '#ef4444' : item.tag === 'P1' ? '#f59e0b' : '#4a4a5a',
                    }}>{item.tag}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[8px] text-zinc-700">
                <span>5 tasks · 3 remaining</span>
                <span className="text-emerald-500/60">On track</span>
              </div>
            </div>
          </div>
        )}
      </div>
    ),
  },
]

const moduleColors: Record<ModuleId, string> = {
  chat: '#a855f7',
  analyst: '#3b82f6',
  exam: '#f59e0b',
  writer: '#ec4899',
  planner: '#10b981',
}

const moduleIcons: Record<ModuleId, React.ReactNode> = {
  chat: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  analyst: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
  exam: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  writer: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  planner: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
}

export function MockUI() {
  const [sceneIdx, setSceneIdx] = useState(0)
  const [phase, setPhase] = useState<'input' | 'thinking' | 'done'>('input')
  const [thinkStep, setThinkStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const scene = scenes[sceneIdx]
  const color = moduleColors[scene.module]

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return

    // Phase sequence: input → thinking (through steps) → done → pause → next scene
    const timers: ReturnType<typeof setTimeout>[] = []

    const runScene = () => {
      setPhase('input')
      setThinkStep(0)

      const t1 = setTimeout(() => {
        setPhase('thinking')
        setThinkStep(0)

        const thinkPhases = scene.thinkPhases
        const stepInterval = 800

        thinkPhases.forEach((_, i) => {
          if (i < thinkPhases.length - 1) {
            timers.push(setTimeout(() => setThinkStep(i + 1), (i + 1) * stepInterval))
          }
        })

        const t2 = setTimeout(() => {
          setPhase('done')
          setThinkStep(thinkPhases.length - 1)

          const t3 = setTimeout(() => {
            setSceneIdx(i => (i + 1) % scenes.length)
            runScene()
          }, 2500)
          timers.push(t3)
        }, thinkPhases.length * stepInterval + 400)
        timers.push(t2)
      }, 1200)
      timers.push(t1)
    }

    const initialDelay = setTimeout(runScene, 500)
    timers.push(initialDelay)

    return () => timers.forEach(clearTimeout)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className="relative w-full max-w-[460px] mx-auto">
      {/* Dynamic ambient glow */}
      <div
        className="absolute -inset-16 rounded-full blur-[100px] transition-all duration-1000"
        style={{ background: `${color}18` }}
      />

      {/* Device frame */}
      <div
        className="relative rounded-[24px] transition-all duration-700 overflow-hidden"
        style={{
          background: '#0a0a0f',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 40px ${color}08`,
        }}
      >
        {/* Status bar */}
        <div className="px-4 pt-2.5 pb-1 flex items-center justify-between text-[8px] text-zinc-700 font-medium">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 9l4 4-4 4"/><path d="M7 17h10l4-4-4-4H7"/></svg>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
          </div>
        </div>

        {/* App header */}
        <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-tight">GIA</span>
            {/* Animated module pill */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-semibold transition-all duration-500 border"
              key={scene.module}
              style={{
                background: `${color}15`,
                borderColor: `${color}25`,
                color: color,
              }}
            >
              <span className="transition-colors duration-500">{moduleIcons[scene.module]}</span>
              <span className="hidden sm:inline capitalize">{scene.module}</span>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.4"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.4)' }} />
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-[7px] font-bold text-white shadow-lg shadow-violet-500/20">
              A
            </div>
          </div>
        </div>

        {/* Module indicator bar - animated */}
        <div
          className="h-0.5 transition-all duration-700"
          style={{
            background: `linear-gradient(90deg, ${color}, ${color}40, transparent)`,
            width: phase === 'input' ? '20%' : phase === 'thinking' ? '60%' : '100%',
            transition: 'width 1.5s ease-in-out, background 0.5s',
          }}
        />

        {/* Content area */}
        <div className="px-3 py-3 min-h-[300px]">
          {/* Module label */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="w-4 h-4 rounded flex items-center justify-center transition-colors duration-500" style={{ background: `${color}20` }}>
              <span className="transition-colors duration-500" style={{ color }}>{moduleIcons[scene.module]}</span>
            </div>
            <span className="text-[10px] font-semibold transition-colors duration-500 capitalize" style={{ color: `${color}cc` }}>
              {scene.module}
            </span>
            {phase === 'thinking' && (
              <div className="flex gap-1 ml-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full animate-bounce" style={{
                    background: color,
                    animationDelay: `${i * 0.15}s`,
                  }} />
                ))}
              </div>
            )}
            {phase === 'done' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" className="ml-auto">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>

          {/* User input typing animation */}
          {phase === 'input' && (
            <div className="flex flex-row-reverse items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div className="p-2.5 rounded-[16px_16px_4px_16px] bg-violet-600/10 border border-violet-500/20 text-xs max-w-[78%]">
                <Typewriter text={scene.userInput} speed={30} />
              </div>
            </div>
          )}

          {/* Scene content */}
          {phase !== 'input' && scene.render(phase === 'thinking' ? scene.thinkPhases[thinkStep] : 'done')}
        </div>

        {/* Input bar */}
        <div className="px-3 py-2 border-t border-white/[0.04]">
          <div
            className="flex items-center gap-2 p-1.5 rounded-xl border transition-colors duration-500"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: `${color}20`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a5a70" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            <input
              type="text"
              placeholder={`Message ${scene.module === 'chat' ? 'GIA' : scene.module}…`}
              className="flex-1 bg-transparent text-xs text-zinc-500 placeholder-zinc-700 outline-none"
              value=""
              readOnly
            />
            <div
              className="w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all duration-500"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Scene description */}
      <div className="mt-3 text-center">
        <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto transition-all duration-300">
          {phase === 'input' && 'Typing your request…'}
          {phase === 'thinking' && `Thinking: ${scene.thinkPhases[thinkStep]}`}
          {phase === 'done' && `${scene.module === 'chat' ? 'Code generated' : scene.module === 'analyst' ? 'Analysis complete' : scene.module === 'exam' ? 'Question ready' : scene.module === 'writer' ? 'Draft written' : 'Sprint planned'} ✓`}
        </p>
      </div>

      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {scenes.map((s, i) => (
          <button
            key={s.module}
            onClick={() => { setSceneIdx(i); setPhase('input'); setThinkStep(0) }}
            className="w-1.5 h-1.5 rounded-full transition-all duration-500 cursor-pointer"
            style={{
              background: i === sceneIdx ? moduleColors[s.module] : 'rgba(255,255,255,0.08)',
              width: i === sceneIdx ? '20px' : '6px',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function Typewriter({ text, speed }: { text: string; speed: number }) {
  const [displayed, setDisplayed] = useState('')
  const [cursor, setCursor] = useState(true)

  useEffect(() => {
    let i = 0
    setDisplayed('')
    const t = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(t)
      }
    }, speed)
    return () => clearInterval(t)
  }, [text, speed])

  useEffect(() => {
    const t = setInterval(() => setCursor(c => !c), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <span className="text-zinc-200">
      {displayed}
      <span className={cursor ? 'opacity-100' : 'opacity-0'} style={{ color: '#a855f7' }}>▋</span>
    </span>
  )
}
