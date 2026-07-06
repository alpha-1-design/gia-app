import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  BarChart3, MessageCircle, Wrench, AlertTriangle, Clock,
  Brain, Zap, Activity, TrendingUp, Cpu, Terminal,
  ChevronDown, ChevronUp, ChevronLeft, Calendar,
} from 'lucide-react';
import { useGiaStore, type Message } from '../store/useGiaStore';
import AnalyticsService from '../services/AnalyticsService';
import AnalyticsTracker from '../services/AnalyticsTracker';

interface FlatMsg {
  role: string;
  timestamp: number;
  error?: boolean;
  model?: string;
  tokenUsage?: { input: number; output: number };
  thinking?: boolean;
  content?: string;
  sessionTitle: string;
}

function flattenMessages(sessions: { title: string; messages: { message: Message; children: unknown[] }[] }[]): FlatMsg[] {
  const result: FlatMsg[] = [];
  for (const session of sessions) {
    const walk = (nodes: { message: Message; children: unknown[] }[]) => {
      for (const node of nodes) {
        result.push({
          role: node.message.role,
          timestamp: node.message.timestamp,
          error: node.message.error,
          model: node.message.model,
          tokenUsage: node.message.tokenUsage,
          thinking: node.message.thinking,
          content: node.message.content,
          sessionTitle: session.title,
        });
        if (node.children) walk(node.children as { message: Message; children: unknown[] }[]);
      }
    };
    if (session.messages) walk(session.messages as { message: Message; children: unknown[] }[]);
  }
  return result;
}

export const DashboardModule: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { sessions } = useGiaStore(useShallow(s => ({
    sessions: s.sessions,
  })));

  const [showAllTools, setShowAllTools] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [showAllRaw, setShowAllRaw] = useState(false);

  const analytics = useMemo(() => {
    const summary = AnalyticsService.getSummary();
    const trackerData = AnalyticsTracker.getSummary();
    const allMessages = flattenMessages(sessions as never);

    const toolCalls: { name: string; timestamp: number; success: boolean }[] = [];
    const errors: { msg: string; timestamp: number; sessionTitle: string }[] = [];
    const modelUsage: Record<string, number> = {};
    let toolCallCount = 0;
    let toolSuccessCount = 0;
    let freezeEvents = 0;
    let totalTokens = 0;

    for (let i = 0; i < allMessages.length; i++) {
      const m = allMessages[i];
      if (m.model) modelUsage[m.model] = (modelUsage[m.model] || 0) + 1;

      if (m.tokenUsage) {
        totalTokens += (m.tokenUsage.input || 0) + (m.tokenUsage.output || 0);
      }

      if (m.error) {
        errors.push({
          msg: (m.content || '').slice(0, 120) || 'Unknown error',
          timestamp: m.timestamp,
          sessionTitle: m.sessionTitle,
        });
      }

      if (m.role === 'assistant' && m.content?.includes('```tool')) {
        const blockRegex = /```tool\s*\n?({[\s\S]*?})\n?```/g;
        let blockMatch;
        while ((blockMatch = blockRegex.exec(m.content)) !== null) {
          try {
            const parsed = JSON.parse(blockMatch[1]);
            const name = parsed.id || parsed.name || 'unknown';
            toolCalls.push({ name, timestamp: m.timestamp, success: true });
            toolCallCount++;
            toolSuccessCount++;
          } catch {
            const nameMatch = blockMatch[1].match(/"id"\s*:\s*"([^"]+)"/);
            const name = nameMatch ? nameMatch[1] : 'unknown';
            toolCalls.push({ name, timestamp: m.timestamp, success: true });
            toolCallCount++;
            toolSuccessCount++;
          }
        }
      }

      if (m.thinking && (m.content || '').length === 0) {
        freezeEvents++;
      }
    }

    const userCount = allMessages.filter(m => m.role === 'user').length;
    const assistantCount = allMessages.filter(m => m.role === 'assistant').length;



    return {
      sessionsCount: sessions.length,
      userMessages: userCount,
      assistantMessages: assistantCount,
      toolCalls,
      toolCallCount,
      toolSuccessCount,
      toolFailCount: toolCallCount - toolSuccessCount,
      errors,
      errorCount: errors.length,
      freezeEvents,
      modelUsage,
      totalTokens,
      ...summary,
      ...trackerData,
    };
  }, [sessions]);

  const rawOutputs = useMemo(() => AnalyticsTracker.getRecentRawOutputs(20), []);

  const toolStats = useMemo(() => {
    const counts: Record<string, { total: number; success: number }> = {};
    for (const tc of analytics.toolCalls) {
      if (!counts[tc.name]) counts[tc.name] = { total: 0, success: 0 };
      counts[tc.name].total++;
      if (tc.success) counts[tc.name].success++;
    }
    return Object.entries(counts)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [analytics.toolCalls]);

  const successRate = analytics.toolCallCount > 0
    ? Math.round((analytics.toolSuccessCount / analytics.toolCallCount) * 100)
    : 100;

  const freezeRate = analytics.assistantMessages > 0
    ? Math.round((analytics.freezeEvents / analytics.assistantMessages) * 100)
    : 0;

  const overviewCards = [
    {
      icon: <MessageCircle size={16} />,
      label: 'Total Chats',
      value: analytics.sessionsCount,
      sub: `${analytics.userMessages + analytics.assistantMessages} messages`,
      color: '#a855f7',
    },
    {
      icon: <Terminal size={16} />,
      label: 'Tool Calls',
      value: analytics.toolCallCount,
      sub: `${successRate}% success rate`,
      color: '#f59e0b',
    },
    {
      icon: <Brain size={16} />,
      label: 'Model Runs',
      value: Object.values(analytics.modelUsage).reduce((a, b) => a + b, 0),
      sub: `${Object.keys(analytics.modelUsage).length} models used`,
      color: '#3b82f6',
    },
    {
      icon: <AlertTriangle size={16} />,
      label: 'Errors',
      value: analytics.errorCount,
      sub: `${analytics.freezeEvents} freeze events`,
      color: analytics.errorCount > 0 ? '#f87171' : '#34d399',
    },
  ];

  const qualityCards = [
    { icon: <Activity size={16} />, label: 'Success Rate', value: `${successRate}%`, desc: 'Tool call success', color: successRate > 80 ? '#34d399' : '#f59e0b' },
    { icon: <Clock size={16} />, label: 'Avg Response', value: `${analytics.runCount > 0 ? Math.round(analytics.eventCount / analytics.runCount) : 0}`, desc: 'Events per session', color: '#3b82f6' },
    { icon: <Zap size={16} />, label: 'Freeze Rate', value: `${freezeRate}%`, desc: 'Of assistant messages', color: freezeRate > 10 ? '#f87171' : '#34d399' },
    { icon: <Cpu size={16} />, label: 'Total Tokens', value: analytics.totalTokens.toLocaleString(), desc: 'Across all sessions', color: '#a855f7' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <div className="flex items-center gap-3 mb-2">
        {onBack && (
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center tap-feedback" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
            <ChevronLeft size={18} style={{ color: 'var(--gia-muted)' }} />
          </button>
        )}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <BarChart3 size={18} style={{ color: '#3b82f6' }} />
        </div>
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--gia-text)' }}>Dashboard</h1>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>GIA performance & activity analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {overviewCards.map(card => (
          <div key={card.label} className="gia-card p-3 rounded-xl" style={{ borderColor: `${card.color}20` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}12` }}>
                <span style={{ color: card.color }}>{card.icon}</span>
              </div>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>{card.value}</p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: card.color }}>{card.label}</p>
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <TrendingUp size={14} style={{ color: '#34d399' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Response Quality</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {qualityCards.map(card => (
            <div key={card.label} className="gia-card p-3 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ color: card.color }}>{card.icon}</span>
                <span className="text-xs font-bold" style={{ color: card.color }}>{card.value}</span>
              </div>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--gia-text)' }}>{card.label}</p>
              <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={14} style={{ color: '#f59e0b' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Tool Usage</span>
          </div>
          <button onClick={() => setShowAllTools(s => !s)}
            className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
            {showAllTools ? 'Less' : 'All'} {showAllTools ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
        {toolStats.length === 0 ? (
          <p className="text-[10px] text-center py-3" style={{ color: 'var(--gia-muted-2)' }}>No tool calls recorded yet. Chat with GIA to see usage.</p>
        ) : (
          <div className="space-y-1.5">
            {(showAllTools ? toolStats : toolStats.slice(0, 5)).map(tool => {
              const pct = toolStats.length > 0 ? Math.round((tool.total / analytics.toolCallCount) * 100) : 0;
              return (
                <div key={tool.name} className="flex items-center gap-2 py-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{tool.name}</span>
                      <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{tool.total}x</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderColor: 'rgba(245,158,11,0.15)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={14} style={{ color: '#f59e0b' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Tool Honesty</span>
          </div>
          <div className="flex items-center gap-2">
            {analytics.hallucinationRate !== undefined && (
              <span className="text-[9px] px-2 py-0.5 rounded-full" style={{
                background: (analytics.hallucinationRate || 0) > 5 ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)',
                color: (analytics.hallucinationRate || 0) > 5 ? '#f87171' : '#34d399',
              }}>
                {(analytics.hallucinationRate || 0)}% hallucination
              </span>
            )}
          </div>
        </div>
        {(analytics.toolCompare || []).length === 0 ? (
          <p className="text-[10px] text-center py-3" style={{ color: 'var(--gia-muted-2)' }}>No tool data tracked yet.</p>
        ) : (
          <div className="space-y-2">
            {(analytics.toolCompare as { id: string; claimed: number; executed: number; hallucinated: number }[])
              .filter(t => t.claimed > 0 || t.executed > 0)
              .map(tool => {
                const hallucinatedCount = tool.hallucinated;
                const pctClaimed = tool.claimed > 0 ? Math.round((tool.executed / tool.claimed) * 100) : 0;
                return (
                  <div key={tool.id} className="flex items-center gap-2 py-0.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{tool.id}</span>
                        <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
                          {tool.executed}/{tool.claimed} executed
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full" style={{
                          width: `${pctClaimed}%`,
                          background: pctClaimed < 80 ? 'linear-gradient(90deg, #f87171, #f59e0b)' : 'linear-gradient(90deg, #34d399, #10b981)',
                        }} />
                      </div>
                      {hallucinatedCount > 0 && (
                        <p className="text-[8px] mt-0.5" style={{ color: '#f87171' }}>
                          {hallucinatedCount} unexecuted claim{hallucinatedCount > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: '#3b82f6' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Model Usage</span>
        </div>
        {Object.keys(analytics.modelUsage).length === 0 ? (
          <p className="text-[10px] text-center py-3" style={{ color: 'var(--gia-muted-2)' }}>No models tracked yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(analytics.modelUsage)
              .sort((a, b) => b[1] - a[1])
              .map(([model, count]) => (
                <span key={model}
                  className="text-[9px] px-2 py-1 rounded-full flex items-center gap-1.5"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                  <Zap size={8} />
                  {model.replace(/^.*\//, '').replace(/-/g, ' ')} <span style={{ opacity: 0.6 }}>{count}x</span>
                </span>
              ))}
          </div>
        )}
      </div>

      {analytics.rawOutputCount > 0 && (
        <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderColor: 'rgba(245,158,11,0.15)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Raw Output Alerts ({analytics.rawOutputCount})</span>
            </div>
            <button onClick={() => setShowAllRaw(s => !s)}
              className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
              {showAllRaw ? 'Less' : 'All'} {showAllRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {(showAllRaw ? rawOutputs : rawOutputs.slice(0, 5)).map((r, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.04)' }}>
                <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--gia-muted-2)' }}>
                  {new Date(r.timestamp).toLocaleDateString()}
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-medium" style={{ color: '#f59e0b' }}>{r.kind}</p>
                  <p className="text-[8px] truncate" style={{ color: 'var(--gia-muted-2)' }}>{r.snippet}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analytics.errors.length > 0 && (
        <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderColor: 'rgba(239,68,68,0.15)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: '#f87171' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f87171' }}>Errors ({analytics.errors.length})</span>
            </div>
            <button onClick={() => setShowAllErrors(s => !s)}
              className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
              {showAllErrors ? 'Less' : 'All'} {showAllErrors ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {(showAllErrors ? analytics.errors : analytics.errors.slice(0, 5)).map((err, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.04)' }}>
                <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--gia-muted-2)' }}>
                  {new Date(err.timestamp).toLocaleDateString()}
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] truncate" style={{ color: '#f87171' }}>{err.msg}</p>
                  <p className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>{err.sessionTitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: '#94a3b8' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Activity Summary</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[10px]">
          <div>
            <span style={{ color: 'var(--gia-muted-2)' }}>First run</span>
            <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
              {new Date(analytics.firstRun).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span style={{ color: 'var(--gia-muted-2)' }}>Last run</span>
            <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
              {new Date(analytics.lastRun).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span style={{ color: 'var(--gia-muted-2)' }}>Total events tracked</span>
            <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{analytics.eventCount}</p>
          </div>
          <div>
            <span style={{ color: 'var(--gia-muted-2)' }}>Active chat sessions</span>
            <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{analytics.sessionsCount}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-[9px] pb-4" style={{ color: 'var(--gia-muted-2)' }}>
        All data stored locally · No information leaves your device
      </p>
    </div>
  );
};
