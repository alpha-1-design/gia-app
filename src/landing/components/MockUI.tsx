import { useEffect, useRef, useState } from 'react'

const codeSnippet = `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55`

const messages = [
  {
    role: 'user',
    content: 'Write a Fibonacci function in TypeScript',
    time: '2:41 PM',
  },
  {
    role: 'assistant',
    content: `Here's a Fibonacci implementation in TypeScript with both recursive and optimized versions:`,
    code: codeSnippet,
    time: '2:41 PM',
    model: 'Claude Sonnet 4.5',
  },
]

export function MockUI() {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), 300)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="relative w-full max-w-[520px] mx-auto">
      {/* Phone frame */}
      <div className="relative rounded-[32px] bg-[#0a0a0f] border border-white/[0.06] shadow-2xl shadow-violet-500/5 overflow-hidden">
        {/* Status bar */}
        <div className="px-6 pt-3 pb-1 flex items-center justify-between text-[10px] text-zinc-600 font-medium">
          <span>2:41</span>
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 9l4 4-4 4"/><path d="M7 17h10l4-4-4-4H7"/></svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
          </div>
        </div>

        {/* App header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white tracking-tight">GIA</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#18181f] border border-white/[0.06]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span className="text-[10px] font-medium text-zinc-400">Chat</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5a5a70" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/30" />
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
          </div>
        </div>

        {/* Chat header */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a5a70" strokeWidth="2"><path d="M3 3v18h18"/><path d="M19 9l-5 5-4-4-3 3"/></svg>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-zinc-500 font-medium">Claude Sonnet 4.5</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {['Folder', 'Upload', 'Brain', 'Globe', 'Trash2'].map((_, i) => (
              <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a5a70" strokeWidth="2">
                <circle cx="12" cy="12" r="2"/><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/>
              </svg>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="px-4 py-4 space-y-4 min-h-[320px]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5 ${!visible ? 'opacity-0 translate-y-4' : ''} transition-all duration-500`}
              style={{ transitionDelay: `${i * 200}ms` }}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-violet-500 to-violet-700'
                  : 'bg-[#18181f] border border-white/[0.06]'
              }`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill={msg.role === 'user' ? 'white' : '#8888a0'}>
                  {msg.role === 'user' ? (
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  ) : (
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  )}
                </svg>
              </div>

              <div className={`max-w-[80%] ${
                msg.role === 'user'
                  ? 'p-3 rounded-[20px_20px_4px_20px] bg-violet-600/10 border border-violet-500/20'
                  : 'p-3 sm:p-4 rounded-[4px_20px_20px_20px] bg-[#111118] border border-white/[0.05]'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] text-zinc-600">GIA</span>
                    <span className="text-[10px] text-zinc-700">via {msg.model}</span>
                    <span className="text-[9px] text-emerald-500/60 px-1.5 py-0.5 rounded-full bg-emerald-500/10">1.2s</span>
                  </div>
                )}

                <p className={`text-sm leading-relaxed ${
                  msg.role === 'user' ? 'text-zinc-200' : 'text-zinc-400'
                }`}>
                  {msg.content}
                </p>

                {msg.code && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.05]">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[#18181f] border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500/30" />
                          <div className="w-2 h-2 rounded-full bg-amber-500/30" />
                          <div className="w-2 h-2 rounded-full bg-emerald-500/30" />
                        </div>
                        <span className="text-[9px] text-zinc-700 font-mono">fibonacci.ts</span>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a5a70" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                    </div>
                    <pre className="px-3 py-2.5 text-[11px] font-mono leading-relaxed text-zinc-500 overflow-x-auto bg-[#0a0a0f] whitespace-pre">{msg.code}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a5a70" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            <input
              type="text"
              placeholder="Message GIA…"
              className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-700 outline-none"
              value=""
              onChange={() => {}}
            />
            <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-r from-violet-600 to-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </div>
          </div>
        </div>

        {/* Bottom glow */}
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[200px] h-[60px] bg-violet-600/20 blur-[40px] rounded-full pointer-events-none" />
      </div>
    </div>
  )
}
