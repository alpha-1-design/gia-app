import React, { useState, useRef, useCallback } from 'react';
import { BarChart2 as BarChartIcon, Loader2, Paperclip, X, TrendingUp as LineChartIcon, Grid, Download, RefreshCw, PieChart as PieChartIcon } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { useMemoryStore } from '../store/useMemoryStore';
import AmbientInput from '../components/AmbientInput';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { extractJSON } from '../utils/helpers';

interface DataPoint { label: string; value: number | string; color?: string; [key: string]: any }
type ChartType = 'bar' | 'pie' | 'line' | 'table';
const COLORS = ['#7c3aed','#4f46e5','#059669','#dc2626','#d97706','#0891b2','#be185d','#65a30d','#9333ea','#0284c7'];

const AnalystModule: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataPoint[]>([]);
  const [summary, setSummary] = useState('');
  const [narrative, setNarrative] = useState('');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [error, setError] = useState('');
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { setIntentState, addNotification } = useGiaStore();

  const getVal = (v: any) => typeof v === 'number' ? v : parseFloat(v) || 0;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setFileData(reader.result as string); setFileName(file.name); };
    reader.readAsText(file); e.target.value = '';
  };

  const handleAnalyze = useCallback(async () => {
    const text = query.trim(); if (!text || loading) return;
    setLoading(true); setError(''); setNarrative(''); setIntentState('thinking');
    try {
      const prompt = fileData ? `Analyze this data:\n\n${fileData.slice(0,8000)}\n\nUser: ${text}` : text;
      const res = await GiaBrain.generate({
        prompt,
        systemPrompt: `You are a data analyst and insight engine. Respond with valid JSON only:
{"summary":"One punchy insight sentence","narrative":"2-3 sentences of deeper analysis","data":[{"label":"Name","value":42}],"columns":["Label","Value"]}
Rules: 4-15 data points, labels under 20 chars, no markdown, pure JSON. If user wants a table, provide rich rows and columns.`,
        temperature: 0.25,
        maxTokens: 1500,
      });
      const parsed = extractJSON(res.text);
      setData((parsed.data ?? []).map((d: any, i: number) => ({ ...d, color: COLORS[i%COLORS.length] })));
      setSummary(parsed.summary ?? '');
      setNarrative(parsed.narrative ?? '');
      if (parsed.summary) {
        useMemoryStore.getState().addMemory({ key: 'analysis_' + Date.now().toString(36), value: parsed.summary.slice(0, 200), category: 'fact', confidence: 0.5 });
      }
      setIntentState('responding');
      setTimeout(() => setIntentState('idle'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not analyze. Try a more specific query.');
      setIntentState('idle');
    } finally { setLoading(false); }
  }, [query, fileData, loading, setIntentState]);

  const chartTypes: { id: ChartType; icon: React.ReactNode; label: string }[] = [
    { id: 'bar', icon: <BarChartIcon size={13}/>, label: 'Bar' },
    { id: 'pie', icon: <PieChartIcon size={13}/>, label: 'Pie' },
    { id: 'line', icon: <LineChartIcon size={13}/>, label: 'Line' },
    { id: 'table', icon: <Grid size={13}/>, label: 'Table' },
  ];

  const exportCSV = async () => {
    try {
      const csv = 'Label,Value\n' + data.map(d => `"${d.label}",${d.value}`).join('\n');
      const fileName = `analysis-${Date.now()}.csv`;
      await Filesystem.writeFile({
        path: fileName,
        data: csv,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      addNotification(`📊 Analysis exported to Documents: ${fileName}`);
    } catch (e) {
      console.error('Export failed', e);
      const csv = 'Label,Value\n' + data.map(d => `"${d.label}",${d.value}`).join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='analysis.csv'; a.click();
    }
  };

  return (
    <div className="flex flex-col h-full px-4 py-5 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BarChartIcon size={16} className="text-indigo-500" />
          <h2 className="text-sm font-semibold">Analyst</h2>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept=".csv,.json,.txt,.tsv" />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 border border-zinc-800 rounded-lg px-2.5 py-1.5 hover:border-indigo-300 hover:text-indigo-600 transition-all">
            <Paperclip size={11} /> Feed data
          </button>
        </div>
      </div>

      {fileName && (
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 shrink-0">
          <span className="text-xs text-indigo-400 flex-1 truncate">📎 {fileName}</span>
          <button onClick={() => { setFileData(null); setFileName(''); }} className="text-zinc-500 hover:text-rose-400"><X size={13} /></button>
        </div>
      )}

      <div className="shrink-0">
        <AmbientInput value={query} onChange={setQuery} onSubmit={handleAnalyze}
          placeholder={fileData ? 'What do you want to know about this data?' : 'What should I analyze? (topic, numbers, or a URL)'}
          isLoading={loading} />
      </div>

      {error && <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 shrink-0">{error}</p>}

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={22} className="text-indigo-400 animate-spin" />
            <span className="text-[11px] text-zinc-500">Analyzing…</span>
          </div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {summary && (
            <p className="text-xs text-zinc-100 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 leading-relaxed font-medium">{summary}</p>
          )}
          {narrative && <p className="text-xs text-zinc-400 leading-relaxed px-1">{narrative}</p>}

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {chartTypes.map(ct => (
                <button key={ct.id} onClick={() => setChartType(ct.id)}
                  className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-all ${chartType===ct.id?'bg-indigo-500 text-white border-indigo-500':'border-zinc-800 text-zinc-500 hover:border-indigo-300'}`}>
                  {ct.icon}{ct.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={handleAnalyze} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500" title="Refresh"><RefreshCw size={12} /></button>
              <button onClick={exportCSV} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500" title="Export CSV"><Download size={12} /></button>
            </div>
          </div>

          <div className="gia-card p-4 overflow-hidden h-[280px]">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#8888a0" fontSize={10} />
                  <YAxis stroke="#8888a0" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#f0f0f5', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
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
                    contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#f0f0f5', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#8888a0" fontSize={10} />
                  <YAxis stroke="#8888a0" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#f0f0f5', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#7c3aed" fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {chartType === 'table' && (
              <div className="overflow-auto h-full">
                <table className="w-full text-left border-collapse min-w-[300px]">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {Object.keys(data[0] || {}).filter(k => !['color','id'].includes(k)).map(k => (
                        <th key={k} className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider py-2 px-1">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((d, i) => (
                      <tr key={i} className="border-b border-zinc-900/50 last:border-0">
                        {Object.entries(d).filter(([k]) => !['color','id'].includes(k)).map(([k, v], j) => (
                          <td key={j} className="text-xs text-zinc-300 py-2.5 px-1 truncate max-w-[120px]">
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
            <div className="grid grid-cols-2 bg-zinc-900/50 px-4 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <span>Label</span><span className="text-right">Value</span>
            </div>
            {data.map(d => (
              <div key={d.label} className="grid grid-cols-2 px-4 py-2.5 border-b border-zinc-900/50 last:border-0">
                <span className="text-xs text-zinc-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{background:d.color}} />{d.label}
                </span>
                <span className="text-xs text-zinc-500 font-mono text-right">{getVal(d.value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <BarChartIcon size={32} className="text-zinc-800 mx-auto mb-3" />
            <p className="text-xs text-zinc-500">Paste data, a URL, or ask about any topic.</p>
            <p className="text-[10px] text-zinc-600 mt-1">CSV/JSON files supported.</p>
          </div>
        </div>
      )}
    </div>
  );
};
export default AnalystModule;
