import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ListTodo, CheckCircle2, Circle, Download, Trash2, Plus, Loader2, Calendar, Clock, X, Edit3 } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore, ScheduledTask } from '../store/useGiaStore';
import AmbientInput from '../components/AmbientInput';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { extractJSON, getIntervalMs, formatNextRun, notifId } from '../utils/helpers';

interface PlanStep { id: string; title: string; description: string; done: boolean; priority: 'high'|'medium'|'low'; eta?: string }
const PRIORITY_COLORS = {
  high: 'text-rose-500 bg-rose-50 border-rose-100',
  medium: 'text-amber-500 bg-amber-50 border-amber-100',
  low: 'text-emerald-500 bg-emerald-50 border-emerald-100',
};

const genId = () => {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => '0123456789abcdefghijklmnopqrstuvwxyz'[b % 36]).join('');
};

const PlannerModule: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [planTitle, setPlanTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'plan'|'schedule'>('plan');
  const [schedPrompt, setSchedPrompt] = useState('');
  const [schedInterval, setSchedInterval] = useState('daily');
  const [schedLoading, setSchedLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const { setIntentState, scheduledTasks, addScheduledTask, updateTaskStatus, deleteTask, addNotification } = useGiaStore();
  const mountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current);
    };
  }, []);

  const runTask = useCallback(async (task: ScheduledTask) => {
    if (task.status === 'running') return;

    updateTaskStatus(task.id, 'running');
    try {
      const res = await GiaBrain.generate({ prompt: task.prompt, maxTokens: 800 });
      const isRecurring = task.interval && ['hourly', 'daily', 'weekly'].includes(task.interval);
      if (isRecurring) {
        const nextRun = Date.now() + getIntervalMs(task.interval);
        updateTaskStatus(task.id, 'pending', res.text, nextRun);
      } else {
        updateTaskStatus(task.id, 'done', res.text);
      }
      addNotification(`✅ ${task.title.slice(0, 30)}`);
    } catch {
      updateTaskStatus(task.id, 'error', 'Task failed.');
      addNotification(`❌ ${task.title.slice(0, 30)}`);
    }
  }, [updateTaskStatus, addNotification]);

  const handlePlan = useCallback(async () => {
    const text = prompt.trim(); if (!text || loading) return;
    setLoading(true); setError(''); setIntentState('thinking');
    try {
      const res = await GiaBrain.generate({
        prompt: text,
        systemPrompt: `You are a strategic planner. Break this goal into clear, actionable steps. Respond ONLY with valid JSON:
{"title":"Concise plan title","steps":[{"id":"1","title":"Step title","description":"Specific actionable description","priority":"high|medium|low","eta":"e.g. Day 1, Week 2"}]}
Provide 5-9 steps. Priorities must reflect actual importance. No markdown, only JSON.`,
        temperature: 0.45,
        maxTokens: 1500,
      });
      const parsed = extractJSON(res.text);
      setPlanTitle(parsed.title ?? '');
      setSteps((parsed.steps ?? []).map((s: Omit<PlanStep,'done'>) => ({ ...s, done: false })));
      setIntentState('responding');
      setTimeout(() => setIntentState('idle'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not build plan. Be more specific.');
      setIntentState('idle');
    } finally { setLoading(false); }
  }, [prompt, loading, setIntentState]);

  const handleSchedule = useCallback(async () => {
    const text = schedPrompt.trim(); if (!text || schedLoading) return;
    setSchedLoading(true);
    try {
      const now = Date.now();
      const delayMs = getIntervalMs(schedInterval);
      const nextRun = now + delayMs;
      const task: ScheduledTask = {
        id: editingTask?.id || genId(),
        title: text.slice(0, 50),
        prompt: text,
        cronLabel: schedInterval,
        interval: schedInterval as 'hourly' | 'daily' | 'weekly',
        nextRun,
        status: 'pending',
      };

      if (editingTask) {
        deleteTask(editingTask.id);
        setEditingTask(null);
      }
      addScheduledTask(task);
      setSchedPrompt('');
      addNotification(`⏰ Scheduled: ${task.title.slice(0,25)}...`);

      mountTimeoutRef.current = setTimeout(() => runTask(task), delayMs);
    } catch {} finally { setSchedLoading(false); }
  }, [schedPrompt, schedInterval, schedLoading, editingTask, addScheduledTask, updateTaskStatus, deleteTask, addNotification, runTask]);

  const startEdit = (task: ScheduledTask) => {
    setEditingTask(task);
    setSchedPrompt(task.prompt);
    setSchedInterval(task.interval);
    setTab('schedule');
  };

  const toggleStep = (id: string) => setSteps(p => p.map(s => s.id===id ? {...s,done:!s.done} : s));
  const removeStep = (id: string) => setSteps(p => p.filter(s => s.id !== id));
  const doneCount = steps.filter(s => s.done).length;

  const exportPlan = () => {
    const txt = `# ${planTitle}\n\n` + steps.map((s,i) => `${i+1}. [${s.done?'x':' '}] **${s.title}** (${s.priority})${s.eta?` — ${s.eta}`:''}\n   ${s.description}`).join('\n\n');
    const b = new Blob([txt],{type:'text/plain'}); const a = document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=`${planTitle.replace(/\s+/g,'-').toLowerCase()}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  const StatusDot = ({ status }: { status: string }) => (
    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
      status==='done'?'bg-emerald-400':status==='running'?'bg-amber-400 animate-pulse':status==='error'?'bg-rose-400':'bg-zinc-700'
    }`} />
  );

  return (
    <div className="flex flex-col h-full px-4 py-5 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-emerald-500" />
          <h2 className="text-sm font-semibold">Planner</h2>
        </div>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          <button onClick={() => setTab('plan')} className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${tab==='plan'?'bg-zinc-800 text-white shadow-sm':'text-zinc-500'}`}>Plan</button>
          <button onClick={() => setTab('schedule')} className={`text-[10px] px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${tab==='schedule'?'bg-zinc-800 text-white shadow-sm':'text-zinc-500'}`}>
            <Clock size={9} /> Schedule {scheduledTasks.length > 0 && <span className="bg-emerald-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center">{scheduledTasks.length}</span>}
          </button>
        </div>
      </div>

      {tab === 'plan' && (
        <>
          <div className="shrink-0">
            <AmbientInput value={prompt} onChange={setPrompt} onSubmit={handlePlan}
              placeholder="Describe a goal, project, or challenge…" isLoading={loading} />
          </div>

          {error && <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 shrink-0">{error}</p>}

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={22} className="text-emerald-400 animate-spin" />
                <span className="text-[11px] text-zinc-500">Planning…</span>
              </div>
            </div>
          )}

          {!loading && steps.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-100">{planTitle}</p>
                <div className="flex gap-1">
                  <button onClick={exportPlan} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500"><Download size={12} /></button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700"
                    style={{width:`${steps.length?(doneCount/steps.length)*100:0}%`}} />
                </div>
                <span className="text-[10px] text-zinc-500">{doneCount}/{steps.length}</span>
              </div>

              {steps.map((step, i) => (
                <div key={step.id} className={`gia-card p-3.5 flex gap-3 items-start transition-all ${step.done?'opacity-50':''}`}>
                  <button onClick={() => toggleStep(step.id)} className="mt-0.5 shrink-0">
                    {step.done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-zinc-700" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] text-zinc-500 font-mono">{String(i+1).padStart(2,'0')}</span>
                      <p className={`text-xs font-semibold ${step.done?'line-through text-zinc-500':'text-zinc-100'}`}>{step.title}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[step.priority]}`}>{step.priority}</span>
                      {step.eta && <span className="text-[9px] text-zinc-500">{step.eta}</span>}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{step.description}</p>
                  </div>
                  <button onClick={() => removeStep(step.id)} className="shrink-0 text-zinc-700 hover:text-rose-400 transition-colors"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          )}

          {!loading && steps.length === 0 && !error && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <ListTodo size={32} className="text-zinc-800 mx-auto mb-3" />
                <p className="text-xs text-zinc-500">Describe a goal and GIA builds a step-by-step plan.</p>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'schedule' && (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="gia-card p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-400">
                {editingTask ? 'Edit scheduled task' : 'Schedule a recurring task'}
              </p>
              {editingTask && (
                <button onClick={() => { setEditingTask(null); setSchedPrompt(''); }} className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <X size={10} /> Cancel
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {['hourly','daily','weekly'].map(i => (
                <button key={i} onClick={() => setSchedInterval(i)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all capitalize ${schedInterval===i?'bg-emerald-500 text-white border-emerald-500':'border-zinc-800 text-zinc-500'}`}>
                  {i}
                </button>
              ))}
            </div>
            <AmbientInput value={schedPrompt} onChange={setSchedPrompt} onSubmit={handleSchedule}
              placeholder="What should GIA do on schedule?" isLoading={schedLoading} />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {scheduledTasks.length === 0 && (
              <div className="text-center pt-8">
                <Calendar size={28} className="text-zinc-800 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No scheduled tasks yet.</p>
              </div>
            )}
            {scheduledTasks.map(task => (
              <div key={task.id} className="gia-card p-3 flex gap-3 items-start">
                <StatusDot status={task.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-zinc-100 truncate">{task.title}</p>
                    {task.status === 'pending' && (
                      <span className="text-[9px] text-zinc-500 shrink-0">{formatNextRun(task.nextRun)}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 capitalize">{task.cronLabel} · {task.status}</p>
                  {task.lastResult && (
                    <div className="mt-2 text-[11px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg p-2 max-h-20 overflow-y-auto">
                      <MarkdownRenderer content={task.lastResult.slice(0, 200)} />
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(task)} className="text-zinc-700 hover:text-emerald-400 transition-colors p-1"><Edit3 size={11} /></button>
                  <button onClick={() => deleteTask(task.id)} className="text-zinc-700 hover:text-rose-400 transition-colors p-1"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default PlannerModule;
