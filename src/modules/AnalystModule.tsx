import { logger } from '../utils/logger';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BarChart2 as BarChartIcon, Paperclip, X, TrendingUp as LineChartIcon, Grid, Download, RefreshCw, PieChart as PieChartIcon } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { useMemoryStore } from '../store/useMemoryStore';
import AmbientInput from '../components/AmbientInput';
import ThinkingDots from '../components/feedback/ThinkingDots';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isNativePlatform } from '../utils/helpers';
import { buildRetryPrompt, generateWithRetry } from '../utils/generateWithRetry';
import { normalizeAnalysisOutput } from './analyst/normalizeAnalysisOutput';

interface DataPoint { label: string; value: number; color?: string; [key: string]: unknown }
type ChartType = 'bar' | 'pie' | 'line' | 'table';
const COLORS = ['#f5f5f5','#d4d4d4','#b0b0b0','#8c8c8c','#6b6b6b','#525252','#3f3f3f','#9a9a9a','#c9c9c9','#737373'];

const ANALYST_STORAGE_KEY = 'gia-analyst-last-result';

function loadSavedAnalysis(): { data: DataPoint[]; summary: string; narrative: string; query: string } | null {
  try {
    const raw = localStorage.getItem(ANALYST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function saveAnalysis(query: string, data: DataPoint[], summary: string, narrative: string): void {
  try { localStorage.setItem(ANALYST_STORAGE_KEY, JSON.stringify({ query: query.slice(0, 100), data, summary, narrative })); } catch { /* ignore */ }
}

const AnalystModule: React.FC = () => {
  const saved = React.useMemo(() => loadSavedAnalysis(), []);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataPoint[]>(saved?.data ?? []);
  const [summary, setSummary] = useState(saved?.summary ?? '');
  const [narrative, setNarrative] = useState(saved?.narrative ?? '');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [error, setError] = useState('');
  const [retryStatus, setRetryStatus] = useState('');
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setIntentState, addNotification } = useGiaStore(useShallow(s => ({
    setIntentState: s.setIntentState,
    addNotification: s.addNotification,
  })));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
      analysisAbortRef.current?.abort();
    };
  }, []);

  const getVal = (v: unknown) => typeof v === 'number' ? v : parseFloat(v as string) || 0;

  const [fileTruncated, setFileTruncated] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setFileData(content);
      setFileName(file.name);
      setFileTruncated(content.length > 8000);
    };
    reader.onerror = () => { addNotification(`Failed to read ${file.name}`); };
    reader.readAsText(file); e.target.value = '';
  };

  const handleAnalyze = useCallback(async () => {
    const text = query.trim(); if (!text || loading) return;
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 75_000);
    analysisTimeoutRef.current = timeoutId;
    setLoading(true); setError(''); setNarrative(''); setRetryStatus(''); setIntentState('thinking');
    try {
      const prompt = fileData ? `Analyze this data:\n\n${fileData.slice(0,8000)}\n\nUser: ${text}` : text;
      
      const { data: parsed } = await generateWithRetry<{ data: DataPoint[]; summary?: string; narrative?: string; columns?: string[] }>(
        retry => GiaBrain.generate({
          prompt: buildRetryPrompt(prompt, retry),
          systemPrompt: `You are a data analyst and insight engine. Respond with valid JSON only:
{"summary":"One punchy insight sentence","narrative":"2-3 sentences of deeper analysis","data":[{"label":"Name","value":42}],"columns":["Label","Value"]}
Rules: 4-15 data points, labels under 20 chars, no markdown, pure JSON. If user wants a table, provide rich rows and columns.`,
          systemPromptMode: 'append',
          forceJson: true,
          temperature: 0.25,
          maxTokens: 1500,
          signal: controller.signal,
        }),
        {
          moduleName: 'AnalystModule',
          transform: normalizeAnalysisOutput,
          signal: controller.signal,
          onRetry: () => setRetryStatus('Retrying with a cleaner format…'),
        }
      );
      const mapped = parsed.data.map((d, i: number) => ({ ...d, color: COLORS[i%COLORS.length] }));
      setData(mapped);
      setSummary(parsed.summary ?? '');
      setNarrative(parsed.narrative ?? '');
      saveAnalysis(text, mapped, parsed.summary ?? '', parsed.narrative ?? '');
      if (parsed.summary) {
        useMemoryStore.getState().addMemory({ key: 'analysis_' + Date.now().toString(36), value: parsed.summary.slice(0, 200), category: 'fact', tier: 'semantic', confidence: 0.5 });
      }
      setIntentState('responding');
      timerRef.current = setTimeout(() => setIntentState('idle'), 2000);
    } catch (err: unknown) {
      const aborted = controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
      if (aborted) {
        setError('Analysis stopped after 75 seconds. The provider did not return usable data — try again, simplify the request, or switch providers in Settings.');
        setIntentState('idle');
        return;
      }
      const errMsg = err instanceof Error ? err.message : '';
      const isNetwork = errMsg.includes('No internet') || errMsg.includes('offline');
      if (isNetwork) {
        setError('No internet connection. Analysis requires an AI provider; no sample data has been substituted.');
        setIntentState('idle');
      } else {
        setError(errMsg || 'Could not analyze. Try a more specific query.');
        setIntentState('idle');
      }
    } finally {
      clearTimeout(timeoutId);
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
      if (analysisTimeoutRef.current === timeoutId) analysisTimeoutRef.current = null;
      setRetryStatus('');
      setLoading(false);
    }
  }, [query, fileData, loading, setIntentState]);

  const chartTypes: { id: ChartType; icon: React.ReactNode; label: string }[] = [
    { id: 'bar', icon: <BarChartIcon size={13}/>, label: 'Bar' },
    { id: 'pie', icon: <PieChartIcon size={13}/>, label: 'Pie' },
    { id: 'line', icon: <LineChartIcon size={13}/>, label: 'Line' },
    { id: 'table', icon: <Grid size={13}/>, label: 'Table' },
  ];

  const exportCSV = async () => {
    const csv = 'Label,Value\n' + data.map(d => `"${d.label}",${d.value}`).join('\n');
    const fileName = `analysis-${Date.now()}.csv`;
    if (isNativePlatform()) {
      try {
        await Filesystem.writeFile({ path: fileName, data: csv, directory: Directory.Documents, encoding: Encoding.UTF8 });
        addNotification(`📊 Analysis exported: Documents/${fileName}`);
        return;
      } catch (e) {
        logger.error('Native export failed, falling back to browser download:', e);
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    timerRef.current = setTimeout(() => URL.revokeObjectURL(url), 10000);
    addNotification(`📊 Analysis exported: ${fileName}`);
  };

  return (
    <div className="flex flex-col h-full px-4 py-5 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BarChartIcon size={16} style={{ color: 'var(--gia-text)' }} />
          <h2 className="text-sm font-semibold">Analyst</h2>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept=".csv,.json,.txt,.tsv" />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5 transition-all"
            style={{ color: 'var(--gia-muted)', border: '1px solid var(--gia-border)' }}>
            <Paperclip size={11} /> Feed data
          </button>
        </div>
      </div>

      {fileName && (
        <div className="flex flex-col gap-1 shrink-0">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
            <span className="text-xs flex-1 truncate" style={{ color: 'var(--gia-text)' }}>{fileName}</span>
            <button onClick={() => { setFileData(null); setFileName(''); setFileTruncated(false); }} style={{ color: 'var(--gia-muted)' }}><X size={13} /></button>
          </div>
          {fileTruncated && (
            <p className="text-[10px] flex items-center gap-1 px-1" style={{ color: 'var(--gia-muted)' }}>
              File truncated to first 8000 characters for analysis
            </p>
          )}
        </div>
      )}

      <div className="shrink-0">
        <AmbientInput value={query} onChange={setQuery} onSubmit={handleAnalyze}
          placeholder={fileData ? 'What do you want to know about this data?' : 'What should I analyze? (topic, numbers, or a URL)'}
          isLoading={loading} />
      </div>

      {error && <p className="text-xs rounded-xl px-4 py-3 shrink-0" style={{ color: 'var(--gia-text)', background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>{error}</p>}

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <ThinkingDots visible color="bg-[var(--gia-text)]" size={7} />
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--gia-text)' }}>GIA is reading your data</p>
            <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>
              {retryStatus || 'Finding the pattern and building the chart.'}
            </p>
          </div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {summary && (
            <p className="text-xs rounded-xl px-4 py-3 leading-relaxed font-medium" style={{ color: 'var(--gia-text)', background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>{summary}</p>
          )}
          {narrative && <p className="text-xs leading-relaxed px-1" style={{ color: 'var(--gia-muted)' }}>{narrative}</p>}

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {chartTypes.map(ct => (
                <button key={ct.id} onClick={() => setChartType(ct.id)}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-all"
                  style={chartType===ct.id
                    ? { background: 'var(--gia-text)', color: 'var(--gia-bg)', borderColor: 'var(--gia-text)' }
                    : { color: 'var(--gia-muted)', borderColor: 'var(--gia-border)' }}>
                  {ct.icon}{ct.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={handleAnalyze} className="p-1.5 rounded-lg" style={{ color: 'var(--gia-muted)' }} title="Refresh"><RefreshCw size={12} /></button>
              <button onClick={exportCSV} className="p-1.5 rounded-lg" style={{ color: 'var(--gia-muted)' }} title="Export CSV"><Download size={12} /></button>
            </div>
          </div>

          <div className="gia-card p-4 overflow-hidden h-[280px]">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" />
                  <XAxis dataKey="label" stroke="var(--gia-muted)" fontSize={10} />
                  <YAxis stroke="var(--gia-muted)" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--gia-text)', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="var(--gia-text)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartType === 'pie' && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="label"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--gia-text)', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--gia-text)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--gia-text)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" />
                  <XAxis dataKey="label" stroke="var(--gia-muted)" fontSize={10} />
                  <YAxis stroke="var(--gia-muted)" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--gia-text)', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--gia-text)" fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {chartType === 'table' && (
              <div className="overflow-auto h-full">
                <table className="w-full text-left border-collapse min-w-[300px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--gia-border)' }}>
                      {Object.keys(data[0] || {}).filter(k => !['color','id'].includes(k)).map(k => (
                        <th key={k} className="text-[10px] font-bold uppercase tracking-wider py-2 px-1" style={{ color: 'var(--gia-muted)' }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--gia-border)' }}>
                        {Object.entries(d).filter(([k]) => !['color','id'].includes(k)).map(([k, v], j) => (
                          <td key={j} className="text-xs py-2.5 px-1 truncate max-w-[120px]" style={{ color: 'var(--gia-text)' }}>
                            {k === 'label' && <div className="w-1.5 h-1.5 rounded-full inline-block mr-2" style={{background:d.color}} />}
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="gia-card overflow-hidden">
            <div className="grid grid-cols-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)', borderBottom: '1px solid var(--gia-border)' }}>
              <span>Label</span><span className="text-right">Value</span>
            </div>
            {data.map(d => (
              <div key={d.label} className="grid grid-cols-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--gia-border)' }}>
                <span className="text-xs flex items-center gap-2" style={{ color: 'var(--gia-text)' }}>
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{background:d.color}} />{d.label}
                </span>
                <span className="text-xs font-mono text-right" style={{ color: 'var(--gia-muted)' }}>{getVal(d.value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <BarChartIcon size={32} className="mx-auto mb-3" style={{ color: 'var(--gia-border)' }} />
            <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>Paste data, a URL, or ask about any topic.</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--gia-muted)' }}>CSV/JSON files supported.</p>
          </div>
        </div>
      )}
    </div>
  );
};
export default AnalystModule;
