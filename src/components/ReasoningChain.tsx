import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, ChevronDown,
  Loader2, XCircle, CheckCircle2,
} from 'lucide-react';
import GiaIcon from './GiaIcon';
import { TOOL_LABELS } from '../utils/toolLabels';
import type { ProtocolProposal } from '../types/protocol';
import { useGiaStore } from '../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';

interface ReasoningStep {
  id: string;
  type: 'reasoning' | 'tool' | 'result' | 'substep';
  label: string;
  description?: string;
  icon?: React.ReactNode;
  color: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
  subSteps?: string[];
  toolId?: string;
  input?: Record<string, unknown>;
  output?: string;
  startedAt: number;
  endedAt?: number;
}

interface ReasoningChainProps {
  messageId: string;
  thoughts?: string;
  protocols?: ProtocolProposal[];
  isLive?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  research: '#14b8a6',
  code: '#8b5cf6',
  files: '#6366f1',
  creative: '#ec4899',
  memory: '#a855f7',
  knowledge: '#a78bfa',
  agents: '#22c55e',
  security: '#ef4444',
  data: '#3b82f6',
  tasks: '#22c55e',
  social: '#ec4899',
  other: '#a855f7',
};

const TOOL_CATEGORY: Record<string, string> = {
  web_search: 'research', read_url: 'research', browser_navigate: 'research',
  browser_click: 'research', browser_fill: 'research', browser_scroll: 'research',
  page_info: 'research', wikipedia: 'research', weather: 'research',
  get_directions: 'research',
  terminal_run: 'code', sandbox_exec: 'code', build_project: 'code',
  ssh_connect: 'code', code_execution: 'code',
  filesystem_read: 'files', filesystem_write: 'files', list_files: 'files',
  file_search: 'files', zip_project: 'files', create_pdf: 'files',
  image_generation: 'creative',
  save_memory: 'memory', forget_memory: 'memory',
  neura_query: 'knowledge', neura_add: 'knowledge', neura_related: 'knowledge',
  sub_agent_call: 'agents',
  security_scan: 'security', security_firewall: 'security', security_threat_intel: 'security',
  db_query: 'data', connector_call: 'data', http_request: 'data',
  task_create: 'tasks', note_create: 'tasks',
  social_create_post: 'social', social_publish: 'social',
};

function parseThoughtsToSteps(thoughts: string, currentTool?: string | null): ReasoningStep[] {
  if (!thoughts) return [];
  const lines = thoughts.split('\n').filter(Boolean);
  const steps: ReasoningStep[] = [];
  let stepIdx = 0;
  const now = Date.now();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const toolMatch = line.match(/🧠\s+(\w+)\s*→\s*(.*)/);
    const execMatch = line.match(/⚡\s+Executing:\s+(\w+)/);
    const obsMatch = line.match(/^OBSERVATION:\s*(.*)/);
    const failedMatch = line.match(/TOOL FAILED|⚠️/);
    const subMatch = line.match(/^\s*[·•]\s*(.+)/);

    if (toolMatch) {
      const toolId = toolMatch[1];
      const args = toolMatch[2].slice(0, 100);
      const category = TOOL_CATEGORY[toolId] || 'other';
      const color = CATEGORY_COLORS[category] || '#a855f7';
      stepIdx++;
      steps.push({
        id: `step-${stepIdx}`,
        type: 'tool',
        label: TOOL_LABELS[toolId] || toolId,
        description: args,
        toolId,
        color,
        status: 'done',
        startedAt: now - (steps.length * 500),
        endedAt: now - (steps.length * 200),
      });
      continue;
    }

    if (execMatch) {
      const toolId = execMatch[1];
      const category = TOOL_CATEGORY[toolId] || 'other';
      const color = CATEGORY_COLORS[category] || '#a855f7';
      stepIdx++;
      steps.push({
        id: `step-${stepIdx}`,
        type: 'tool',
        label: TOOL_LABELS[toolId] || toolId,
        toolId,
        color,
        status: currentTool === toolId ? 'running' : 'pending',
        startedAt: now - (steps.length * 500),
      });
      continue;
    }

    if (obsMatch) {
      const lastTool = steps.filter(s => s.type === 'tool').pop();
      if (lastTool) {
        lastTool.status = obsMatch[1].includes('Success') || obsMatch[1].includes('✅') ? 'done' : 'error';
        lastTool.endedAt = now;
        lastTool.output = obsMatch[1];
        continue;
      }
      stepIdx++;
      steps.push({
        id: `step-${stepIdx}`,
        type: 'result',
        label: 'Result',
        description: obsMatch[1].slice(0, 120),
        color: obsMatch[1].includes('Success') || obsMatch[1].includes('✅') ? '#34d399' : '#ef4444',
        status: obsMatch[1].includes('Success') || obsMatch[1].includes('✅') ? 'done' : 'error',
        startedAt: now - 100,
        endedAt: now,
      });
      continue;
    }

    if (failedMatch) {
      const lastTool = steps.filter(s => s.type === 'tool').pop();
      if (lastTool) {
        lastTool.status = 'error';
        lastTool.endedAt = now;
      }
      continue;
    }

    if (subMatch) {
      const lastStep = steps[steps.length - 1];
      if (lastStep) {
        if (!lastStep.subSteps) lastStep.subSteps = [];
        lastStep.subSteps.push(subMatch[1]);
      }
      continue;
    }

    // Reasoning step
    if (line.trim() && !line.startsWith('⚡') && !line.startsWith('🧠')) {
      stepIdx++;
      const isReasoning = /thinking|consider|should|need|plan|because|therefore|however|but|so/.test(line.toLowerCase());
      steps.push({
        id: `step-${stepIdx}`,
        type: isReasoning ? 'reasoning' : 'substep',
        label: isReasoning ? 'Reasoning' : 'Step',
        description: line.trim().slice(0, 500),
        color: isReasoning ? '#a855f7' : '#f59e0b',
        status: 'done',
        startedAt: now - (stepIdx * 200),
        endedAt: now - (stepIdx * 100),
      });
    }
  }

  // Add current tool if running
  if (currentTool && !steps.some(s => s.toolId === currentTool && s.status === 'running')) {
    const category = TOOL_CATEGORY[currentTool] || 'other';
    const color = CATEGORY_COLORS[category] || '#a855f7';
    steps.push({
      id: `step-live-${currentTool}`,
      type: 'tool',
      label: TOOL_LABELS[currentTool] || currentTool,
      toolId: currentTool,
      color,
      status: 'running',
      startedAt: Date.now(),
    });
  }

  return steps;
}

function StepIcon({ step, size = 16 }: { step: ReasoningStep; size?: number }) {
  if (step.status === 'running') {
    return (
      <div className="relative flex items-center justify-center" style={{ width: size + 4, height: size + 4 }}>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: `${step.color}20` }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.25, 0.08, 0.25] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex items-center justify-center" style={{ width: size, height: size }}>
          <motion.div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{ background: `${step.color}30`, border: `1.5px solid ${step.color}` }}
            animate={{ boxShadow: [`0 0 0px ${step.color}60`, `0 0 10px ${step.color}80`, `0 0 0px ${step.color}60`] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ color: step.color, lineHeight: 0 }}
            >
              {step.icon || <Loader2 size={size * 0.7} />}
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (step.status === 'done') {
    return (
      <div className="flex items-center justify-center" style={{ width: size + 4, height: size + 4 }}>
        <motion.div
          className="flex items-center justify-center"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: `${step.color}20`,
            border: `1.5px solid ${step.color}`,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        >
          <CheckCircle2 size={size * 0.6} style={{ color: step.color }} />
        </motion.div>
      </div>
    );
  }

  if (step.status === 'error') {
    return (
      <div className="flex items-center justify-center" style={{ width: size + 4, height: size + 4 }}>
        <div className="flex items-center justify-center" style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#ef444420',
          border: '1.5px solid #ef4444',
        }}>
          <XCircle size={size * 0.6} style={{ color: '#ef4444' }} />
        </div>
      </div>
    );
  }

  // pending
  return (
    <div className="flex items-center justify-center" style={{ width: size + 4, height: size + 4 }}>
      <div className="flex items-center justify-center" style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${step.color}15`,
        border: `1.5px dashed ${step.color}`,
      }}>
        <Loader2 size={size * 0.6} style={{ color: step.color, opacity: 0.5 }} />
      </div>
    </div>
  );
}

function ElapsedTimer({ startedAt, endedAt }: { startedAt: number; endedAt?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (endedAt) { setElapsed(endedAt - startedAt); return; }
    const iv = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(iv);
  }, [startedAt, endedAt]);
  const secs = elapsed / 1000;
  if (secs < 0.1) return <span className="font-mono text-[9px] tabular-nums" style={{ color: 'var(--gia-muted-2)' }}>{'<'} 0.1s</span>;
  if (secs < 10) return <span className="font-mono text-[9px] tabular-nums" style={{ color: '#a855f7' }}>{secs.toFixed(1)}s</span>;
  return <span className="font-mono text-[9px] tabular-nums" style={{ color: 'var(--gia-muted-2)' }}>{Math.floor(secs)}s</span>;
}

function ReasoningStepItem({ step, index, total }: { step: ReasoningStep; index: number; total: number }) {
  const category = step.toolId ? TOOL_CATEGORY[step.toolId] : 'other';
  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: index * 0.03 }}
      className="flex items-start gap-2 group"
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
        <StepIcon step={step} size={14} />
        {index < total - 1 && (
          <motion.div
            className="w-px flex-1 my-0.5"
            style={{
              background: step.status === 'done'
                ? `linear-gradient(to bottom, ${step.color}40, transparent)`
                : step.status === 'error'
                  ? 'linear-gradient(to bottom, #ef444440, transparent)'
                  : 'var(--gia-border)',
              minHeight: 12,
            }}
          />
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold shrink-0" style={{
            color: step.status === 'running' ? step.color :
              step.status === 'error' ? '#ef4444' : 'var(--gia-text)'
          }}>
            {step.label}
          </span>

          {step.toolId && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{
              background: `${step.color}15`,
              color: step.color,
            }}>
              {category}
            </span>
          )}

          {step.detail && step.status !== 'running' && (
            <span className="text-[9px] truncate max-w-[180px] font-mono shrink-0" style={{ color: 'var(--gia-muted-2)' }}>
              {step.detail}
            </span>
          )}

          <span className="ml-auto shrink-0">
            <ElapsedTimer startedAt={step.startedAt} endedAt={step.endedAt} />
          </span>
        </div>

        {/* Step description text */}
        {step.description && (
          <div className="text-[11px] mt-0.5 leading-snug font-normal break-words" style={{ color: 'var(--gia-text)', opacity: 0.88 }}>
            {step.description}
          </div>
        )}

        {/* Sub-steps */}
        {step.subSteps && step.subSteps.length > 0 && step.status === 'running' && (
          <div className="mt-0.5 space-y-0.5 ml-6">
            {step.subSteps.slice(-3).map((sub, si) => (
              <motion.div
                key={si}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[9px] font-mono pl-2"
                style={{ color: 'var(--gia-muted)' }}
              >
                {sub}
              </motion.div>
            ))}
          </div>
        )}

        {/* Input/Output expansion for tools */}
        {step.type === 'tool' && (step.input || step.output) && (
          <div className="mt-1.5 ml-6">
            {step.input && (
              <details className="group">
                <summary className="text-[9px] font-mono cursor-pointer select-none" style={{ color: 'var(--gia-muted)' }}>
                  Input
                </summary>
                <pre className="mt-1 text-[9px] font-mono p-2 rounded bg-black/30 overflow-x-auto" style={{ color: 'var(--gia-text)' }}>
                  {JSON.stringify(step.input, null, 2)}
                </pre>
              </details>
            )}
            {step.output && (
              <details className="group mt-1">
                <summary className="text-[9px] font-mono cursor-pointer select-none" style={{ color: 'var(--gia-muted)' }}>
                  Output
                </summary>
                <pre className="mt-1 text-[9px] font-mono p-2 rounded bg-black/30 overflow-x-auto max-h-32" style={{ color: 'var(--gia-text)' }}>
                  {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Running progress bar */}
        {step.status === 'running' && (
          <motion.div
            className="h-0.5 mt-1 rounded-full overflow-hidden"
            style={{ background: `${step.color}15` }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${step.color}, ${step.color}80)` }}
              animate={{ width: ['0%', '60%', '30%', '80%', '50%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export const ReasoningChain: React.FC<ReasoningChainProps> = ({
  thoughts,
  protocols = [],
  isLive = false,
  isExpanded = false,
  onToggle,
}) => {
  const [expanded, setExpanded] = useState(isExpanded);
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
  const { thinkingPhase, extThinking } = useGiaStore(useShallow(s => ({
    thinkingPhase: s.thinkingPhase,
    extThinking: s.extThinking,
  })));

  useEffect(() => {
    setExpanded(isExpanded);
  }, [isExpanded]);

  // Parse thoughts into structured steps
  const steps = useMemo(() => {
    const thoughtSteps = parseThoughtsToSteps(thoughts || '', null);
    // Add protocol steps
    const protocolSteps = protocols
      .filter(p => p.state !== 'proposed')
      .map((p) => {
        const category = TOOL_CATEGORY[p.type] || 'other';
        const color = CATEGORY_COLORS[category] || '#a855f7';
        const statusMap: Record<string, string> = {
          completed: 'done', failed: 'error', executing: 'running',
        };
        return {
          id: p.id,
          type: 'tool' as const,
          label: TOOL_LABELS[p.type] || p.type,
          toolId: p.type,
          color,
          status: (statusMap[p.state] || 'pending') as 'pending' | 'running' | 'done' | 'error',
          input: p.args,
          output: p.result,
          startedAt: p.createdAt,
          endedAt: p.completedAt || p.executedAt,
        };
      });
    return [...thoughtSteps, ...protocolSteps];
  }, [thoughts, protocols]);

  const completedCount = steps.filter(s => s.status === 'done').length;
  const errorCount = steps.filter(s => s.status === 'error').length;
  const runningStep = steps.find(s => s.status === 'running');

  const phaseLabel = useMemo(() => {
    const labels: Record<string, string> = {
      gathering: 'Gathering info', analyzing: 'Analyzing', coding: 'Coding',
      writing: 'Writing', searching: 'Searching', planning: 'Planning',
      reasoning: 'Reasoning', processing: 'Processing', idle: 'Ready',
    };
    return labels[thinkingPhase || ''] || 'Processing';
  }, [thinkingPhase]);

  const displayLabel = isLive ? phaseLabel : `Reasoning (${completedCount} steps)`;
  const displayIcon = isLive
    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}><GiaIcon size={12} color="#a855f7" /></motion.div>
    : <Brain size={12} style={{ color: '#f59e0b' }} />;

  if (!thoughts && !protocols.length && !isLive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.04), rgba(99,102,241,0.03))',
        border: '1px solid rgba(168,85,247,0.12)',
      }}
    >
      {/* Header */}
      <motion.button
        onClick={() => { onToggle?.(); setExpanded(v => !v); }}
        className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        whileTap={{ scale: 0.99 }}
        style={{ background: 'transparent' }}
      >
        <span className="relative flex items-center justify-center w-5 h-5">
          {displayIcon}
        </span>

        <span className="text-[10px] font-semibold uppercase tracking-wider flex-1" style={{ color: '#f59e0b' }}>
          {displayLabel}
        </span>

        {steps.length > 0 && (
          <div className="flex items-center gap-1.5">
            {completedCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                {completedCount} steps
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                {errorCount} failed
              </span>
            )}
            {runningStep && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${runningStep.color}15`, color: runningStep.color }}>
                running
              </span>
            )}
          </div>
        )}

        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
          <ChevronDown size={11} style={{ color: 'var(--gia-muted)' }} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            {/* View switcher header */}
            <div className="flex items-center justify-between px-3 pt-1 pb-1 border-b" style={{ borderColor: 'rgba(168,85,247,0.08)' }}>
              <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>
                View Mode
              </span>
              <div className="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg border" style={{ borderColor: 'var(--gia-border)' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setViewMode('structured'); }}
                  className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${
                    viewMode === 'structured' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Steps ({steps.length})
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setViewMode('raw'); }}
                  className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${
                    viewMode === 'raw' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Raw Log
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto scroll-smooth" style={{ padding: '8px 12px 12px' }}>
              {viewMode === 'raw' ? (
                <div className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap rounded-lg p-2.5 border" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'var(--gia-border)', color: 'var(--gia-text)' }}>
                  {thoughts || (isLive ? 'Gathering internal thoughts...' : 'No raw logs available.')}
                </div>
              ) : steps.length === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <motion.div
                    className="flex gap-1"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1 h-1 rounded-full" style={{ background: '#a855f7', animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </motion.div>
                  <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Thinking...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {steps.map((step, idx) => (
                    <ReasoningStepItem key={step.id} step={step} index={idx} total={steps.length} />
                  ))}
                </div>
              )}

              {/* Live cursor */}
              {isLive && (
                <div className="flex items-center gap-1 mt-1 ml-6">
                  {extThinking ? (
                    <GiaIcon size={10} animate color="#a855f7" speed={1.4} />
                  ) : (
                    <motion.span
                      className="text-[10px]"
                      style={{ color: '#a855f7' }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      ▋
                    </motion.span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ReasoningChain;