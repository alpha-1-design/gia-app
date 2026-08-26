import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Globe, FileText, Terminal, Zap, CheckCircle, AlertCircle,
  Brain, ChevronDown, ChevronRight, Sparkles, Database,
  Shield, Send, Network, Image, MapPin, Archive, Activity,
} from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
import GiaIcon from './GiaIcon';

interface WorkLogStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
  toolId?: string;
  startedAt: number;
  endedAt?: number;
  subSteps?: string[];
}

// Shared with SegmentedReasoning (tool metadata is a module-level constant,
// not a component — safe to export).
// eslint-disable-next-line react-refresh/only-export-components
export const TOOL_META: Record<string, { label: string; color: string; icon: React.ReactNode; category: string }> = {
  web_search:        { label: 'Searching the web',   color: '#14b8a6', icon: <Search size={12} />,       category: 'research' },
  read_url:          { label: 'Reading page',        color: '#14b8a6', icon: <Globe size={12} />,       category: 'research' },
  browser_navigate:  { label: 'Navigating browser',  color: '#14b8a6', icon: <Globe size={12} />,       category: 'research' },
  browser_click:     { label: 'Clicking element',    color: '#14b8a6', icon: <Globe size={12} />,       category: 'research' },
  browser_fill:      { label: 'Filling form',        color: '#14b8a6', icon: <Globe size={12} />,       category: 'research' },
  browser_scroll:    { label: 'Scrolling page',      color: '#14b8a6', icon: <Globe size={12} />,       category: 'research' },
  page_info:         { label: 'Fetching page info',  color: '#14b8a6', icon: <Globe size={12} />,       category: 'research' },
  terminal_run:      { label: 'Running code',        color: '#8b5cf6', icon: <Terminal size={12} />,     category: 'code' },
  sandbox_exec:      { label: 'Executing in sandbox', color: '#8b5cf6', icon: <Terminal size={12} />,   category: 'code' },
  filesystem_read:   { label: 'Reading file',        color: '#6366f1', icon: <FileText size={12} />,     category: 'files' },
  filesystem_write:  { label: 'Writing file',        color: '#6366f1', icon: <FileText size={12} />,     category: 'files' },
  list_files:        { label: 'Listing files',       color: '#6366f1', icon: <FileText size={12} />,     category: 'files' },
  file_search:       { label: 'Searching files',     color: '#6366f1', icon: <FileText size={12} />,     category: 'files' },
  image_generation:  { label: 'Generating image',    color: '#ec4899', icon: <Image size={12} />,        category: 'creative' },
  create_pdf:        { label: 'Creating PDF',        color: '#f97316', icon: <FileText size={12} />,     category: 'files' },
  save_memory:       { label: 'Saving to memory',    color: '#a855f7', icon: <Brain size={12} />,        category: 'memory' },
  neura_query:       { label: 'Querying knowledge',  color: '#a78bfa', icon: <Network size={12} />,      category: 'knowledge' },
  sub_agent_call:    { label: 'Delegating to agent', color: '#22c55e', icon: <Sparkles size={12} />,     category: 'agents' },
  build_project:     { label: 'Building project',    color: '#f97316', icon: <Zap size={12} />,          category: 'code' },
  zip_project:       { label: 'Creating archive',    color: '#f59e0b', icon: <Archive size={12} />,      category: 'files' },
  security_scan:     { label: 'Scanning security',   color: '#ef4444', icon: <Shield size={12} />,       category: 'security' },
  ssh_connect:       { label: 'SSH connecting',      color: '#6366f1', icon: <Terminal size={12} />,     category: 'code' },
  db_query:          { label: 'Querying database',   color: '#3b82f6', icon: <Database size={12} />,     category: 'data' },
  note_create:       { label: 'Creating note',       color: '#f59e0b', icon: <FileText size={12} />,     category: 'files' },
  task_create:       { label: 'Creating task',       color: '#22c55e', icon: <CheckCircle size={12} />,  category: 'tasks' },
  social_create_post:{ label: 'Creating post',       color: '#ec4899', icon: <Send size={12} />,         category: 'social' },
  weather:           { label: 'Checking weather',    color: '#3b82f6', icon: <Globe size={12} />,        category: 'research' },
  wikipedia:         { label: 'Reading Wikipedia',   color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  get_directions:    { label: 'Getting directions',  color: '#22c55e', icon: <MapPin size={12} />,       category: 'research' },
  connector_call:    { label: 'Calling API',         color: '#3b82f6', icon: <Activity size={12} />,     category: 'data' },
};

function extractToolFromThought(thought: string): { toolId: string; args?: string } | null {
  const brainMatch = thought.match(/🧠\s+(\w+)\s*→\s*(.*)/);
  if (brainMatch) return { toolId: brainMatch[1], args: brainMatch[2].slice(0, 80) };
  const execMatch = thought.match(/⚡\s+Executing:\s+(\w+)/);
  if (execMatch) return { toolId: execMatch[1] };
  return null;
}

function ElapsedTimer({ startedAt, endedAt }: { startedAt: number; endedAt?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (endedAt) { setElapsed(endedAt - startedAt); return; }
    const iv = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(iv);
  }, [startedAt, endedAt]);
  const secs = elapsed / 1000;
  return (
    <span className="font-mono text-[10px] tabular-nums" style={{ color: endedAt ? 'var(--gia-muted-2)' : '#a855f7' }}>
      {secs < 10 ? secs.toFixed(1) + 's' : Math.floor(secs) + 's'}
    </span>
  );
}

function StepIcon({ step }: { step: WorkLogStep }) {
  if (step.status === 'running') {
    return (
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute rounded-full"
          style={{ width: 24, height: 24, background: `${step.color}15` }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.15, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="relative z-10 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: `${step.color}30`, border: `1.5px solid ${step.color}` }}
          animate={{ boxShadow: [`0 0 0px ${step.color}40`, `0 0 12px ${step.color}60`, `0 0 0px ${step.color}40`] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ color: step.color, lineHeight: 0 }}
          >
            {step.icon}
          </motion.div>
        </motion.div>
      </div>
    );
  }
  if (step.status === 'done') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: `${step.color}20` }}
      >
        <CheckCircle size={11} style={{ color: step.color }} />
      </motion.div>
    );
  }
  if (step.status === 'error') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.15)' }}
      >
        <AlertCircle size={11} style={{ color: '#ef4444' }} />
      </motion.div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--gia-surface-2)' }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gia-muted-2)' }} />
    </div>
  );
}

function buildStepsFromThoughts(thoughts: string, currentTool?: string | null): WorkLogStep[] {
  const lines = thoughts.split('\n').filter(Boolean);
  const steps: WorkLogStep[] = [];
  let stepIdx = 0;

  for (const line of lines) {
    const tool = extractToolFromThought(line);
    if (tool) {
      const meta = TOOL_META[tool.toolId] || { label: tool.toolId, color: '#a855f7', icon: <Zap size={12} />, category: 'other' };
      const isRunning = currentTool === tool.toolId;
      const prevStep = steps[steps.length - 1];
      if (prevStep && prevStep.status === 'running' && prevStep.toolId === tool.toolId) continue;
      stepIdx++;
      steps.push({
        id: `step-${stepIdx}`,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        status: isRunning ? 'running' : line.startsWith('✅') || line.includes('completed') || line.includes('Success') ? 'done' : 'done',
        detail: tool.args,
        toolId: tool.toolId,
        startedAt: Date.now() - (steps.length * 200),
        endedAt: isRunning ? undefined : Date.now() - (steps.length * 100),
      });
      continue;
    }
    if (line.startsWith('OBSERVATION:')) {
      const lastStep = steps[steps.length - 1];
      if (lastStep && lastStep.status === 'running') {
        lastStep.status = line.includes('Success') ? 'done' : 'error';
        lastStep.endedAt = Date.now();
        lastStep.detail = line.length > 120 ? line.slice(0, 117) + '…' : line;
      }
      continue;
    }
    if (line.startsWith('⚡') || line.startsWith('🧠')) continue;
    if (line.startsWith('  · ') || line.startsWith('    ')) {
      const lastStep = steps[steps.length - 1];
      if (lastStep) {
        if (!lastStep.subSteps) lastStep.subSteps = [];
        lastStep.subSteps.push(line.trim());
      }
      continue;
    }
    if (line.startsWith('⚠️') || line.startsWith('TOOL FAILED')) {
      const lastStep = steps[steps.length - 1];
      if (lastStep && lastStep.status === 'running') {
        lastStep.status = 'error';
        lastStep.endedAt = Date.now();
      }
      continue;
    }
  }

  if (currentTool) {
    const existing = steps.find(s => s.toolId === currentTool && s.status === 'running');
    if (!existing) {
      const meta = TOOL_META[currentTool] || { label: currentTool, color: '#a855f7', icon: <Zap size={12} />, category: 'other' };
      steps.push({
        id: `step-live-${currentTool}`,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        status: 'running',
        toolId: currentTool,
        startedAt: Date.now(),
      });
    }
  }

  return steps;
}

interface WorkLogProps {
  thoughts: string;
  isLive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  currentTool?: string | null | undefined;
  thinkingPhase?: string;
  startTime?: number;
}

export const WorkLog: React.FC<WorkLogProps> = ({
  thoughts, isLive, isExpanded, onToggle, currentTool, thinkingPhase, startTime,
}) => {
  const extThinking = useGiaStore(s => s.extThinking);
  const buildMode = useGiaStore(s => s.buildMode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const steps = useMemo(() => buildStepsFromThoughts(thoughts, currentTool), [thoughts, currentTool]);
  const completedCount = steps.filter(s => s.status === 'done').length;
  const errorCount = steps.filter(s => s.status === 'error').length;
  const runningStep = steps.find(s => s.status === 'running');

  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts, isLive]);

  if (!thoughts && !isLive) return null;
  if (!isExpanded && !isLive) return null;

  const phaseLabel = (() => {
    const labels: Record<string, string> = {
      gathering: 'Sniffing around', analyzing: 'Squinting at it', coding: 'Cooking',
      writing: 'Spilling ink', searching: 'Googling stuff', planning: 'Drawing maps',
      reasoning: 'Big brain time', processing: 'Crunching bytes', idle: 'Ready',
    };
    return labels[thinkingPhase || ''] || 'Processing';
  })();

  const PHASE_EXTRAS = [
    'Doing stuff or something',
    'I think I know what I\'m doing',
    'Pretending to know things',
    'Following the breadcrumbs',
    'Thinking hard about thinking',
    'Loading... just kidding, working',
    'Convincing the electrons',
    'Asking the right questions',
    'Making it up as I go',
    'Trusting the process',
    'Vibing and coding',
    'One sec, almost there',
    'Consulting the void',
    'Doing my best impression of useful',
    'Winging it (successfully)',
  ];

  const BUILD_EXTRAS = [
    'Shipping it',
    'No pressure, just building an app',
    'Crafting digital excellence',
    'This is fine',
    'Building something cool',
    'Hopefully this works',
    'Making it rain code',
    'Engineering (kind of)',
    'Trust me, I\'m an AI',
    'Hack hack hack',
    'Turning caffeine into code (metaphorically)',
    'Building the future (or at least a webpage)',
    'Deploying good vibes',
    'Compiling happiness',
    '10x developer moment',
  ];

  const displayPhaseLabel = (() => {
    const cycle = Math.floor(Date.now() / 1800);
    if (cycle % 3 === 0) {
      const extras = buildMode ? BUILD_EXTRAS : PHASE_EXTRAS;
      return extras[cycle % extras.length];
    }
    return phaseLabel;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.04), rgba(99,102,241,0.03))',
        border: '1px solid rgba(168,85,247,0.12)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={onToggle}
        style={{
          background: 'linear-gradient(90deg, rgba(168,85,247,0.08), transparent)',
          borderBottom: isExpanded ? '1px solid rgba(168,85,247,0.1)' : 'none',
        }}
      >
        {isLive ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <GiaIcon size={13} animate color={runningStep ? runningStep.color : '#a855f7'} />
          </motion.div>
        ) : (
          <Brain size={13} style={{ color: '#f59e0b' }} />
        )}

        <span className="text-[10px] font-semibold uppercase tracking-wider flex-1" style={{ color: isLive ? '#a855f7' : '#f59e0b' }}>
          {isLive ? displayPhaseLabel : 'Reasoning'}
        </span>

        {steps.length > 0 && (
          <div className="flex items-center gap-1.5">
            {completedCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                {completedCount} done
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

        {startTime && <ElapsedTimer startedAt={startTime} endedAt={isLive ? undefined : Date.now()} />}

        {isExpanded ? <ChevronDown size={11} style={{ color: 'var(--gia-muted)' }} /> : <ChevronRight size={11} style={{ color: 'var(--gia-muted)' }} />}
      </div>

      {/* Steps timeline */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            ref={scrollRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-h-64 overflow-y-auto scroll-smooth"
            style={{ padding: '8px 12px 12px' }}
          >
            {steps.length === 0 ? (
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
                {steps.map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="flex items-start gap-2 group"
                  >
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
                      <StepIcon step={step} />
                      {i < steps.length - 1 && (
                        <div className="w-px flex-1 my-0.5" style={{
                          background: step.status === 'done'
                            ? `linear-gradient(to bottom, ${step.color}40, transparent)`
                            : 'var(--gia-border)',
                          minHeight: 8,
                        }} />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium" style={{ color: step.status === 'running' ? step.color : step.status === 'error' ? '#ef4444' : 'var(--gia-text)' }}>
                          {step.label}
                        </span>
                        {step.detail && step.status !== 'running' && (
                          <span className="text-[9px] truncate max-w-[200px]" style={{ color: 'var(--gia-muted-2)' }}>
                            {step.detail}
                          </span>
                        )}
                        <span className="ml-auto shrink-0">
                          <ElapsedTimer startedAt={step.startedAt} endedAt={step.endedAt} />
                        </span>
                      </div>

                      {/* Sub-steps */}
                      {step.subSteps && step.subSteps.length > 0 && step.status === 'running' && (
                        <div className="mt-0.5 space-y-0.5">
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

                      {/* Running indicator */}
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
                ))}
              </div>
            )}

            {/* Live cursor */}
            {isLive && (
              <div className="flex items-center gap-1 mt-1 ml-5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
