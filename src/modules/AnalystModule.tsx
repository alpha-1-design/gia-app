import React, { useState, useRef, useCallback } from 'react';
import { BarChart2, Loader2, Paperclip, X, PieChart, TrendingUp, Grid, Download, RefreshCw } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import AmbientInput from '../components/AmbientInput';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface DataPoint { label: string; value: number | string; color?: string; [key: string]: any }
type ChartType = 'bar' | 'pie' | 'line' | 'area' | 'table';
const COLORS = ['#7c3aed','#4f46e5','#059669','#dc2626','#d97706','#0891b2','#be185d','#65a30d','#9333ea','#0284c7'];

const getVal = (v: any) => typeof v === 'number' ? v : parseFloat(v) || 0;

const PieChartSVG: React.FC<{ data: DataPoint[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + getVal(d.value), 0);
  let cum = 0;
  const slices = data.map((d, i) => {
    const val = getVal(d.value);
    const pct = total === 0 ? 0 : val / total;
    const s = cum; cum += pct;
    const a1 = s * 2 * Math.PI - Math.PI / 2;
    const a2 = cum * 2 * Math.PI - Math.PI / 2;
    const x1 = 50 + 42 * Math.cos(a1); const y1 = 50 + 42 * Math.sin(a1);
    const x2 = 50 + 42 * Math.cos(a2); const y2 = 50 + 42 * Math.sin(a2);
    return { path: `M50 50 L${x1} ${y1} A42 42 0 ${pct>0.5?1:0} 1 ${x2} ${y2}Z`, color: COLORS[i%COLORS.length], label: d.label, pct: Math.round(pct*100) };
  });
  return (
    <div className="flex gap-4 items-center">
      <svg viewBox="0 0 100 100" className="w-36 h-36 shrink-0">
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="0.8" />)}
        <circle cx="50" cy="50" r="22" fill="white" />
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{background:s.color}} />
            <span className="text-gray-600 flex-1 truncate">{s.label}</span>
            <span className="text-gray-400 font-mono text-[10px]">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LineChartSVG: React.FC<{ data: DataPoint[]; area?: boolean }> = ({ data, area }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data.map(d => getVal(d.value)));
  const w = 280; const h = 110; const pad = 24;
  const pts = data.map((d, i) => ({ x: pad + (i/(data.length-1))*(w-pad*2), y: h-pad-(getVal(d.value)/max)*(h-pad*2) }));
  const path = pts.map((p,i) => `${i===0?'M':'L'}${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L${pts[pts.length-1].x} ${h-pad} L${pts[0].x} ${h-pad}Z`;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{minWidth:200}}>
        {area && <path d={areaPath} fill="rgba(124,58,237,0.08)" />}
        <path d={path} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#7c3aed" />
            <text x={p.x} y={h-6} textAnchor="middle" fontSize="7" fill="#9ca3af">{data[i].label.slice(0,6)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

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
  const { setIntentState } = useGiaStore();

  const getVal = (v: any) => typeof v === 'number' ? v : parseFloat(v) || 0;
  const max = Math.max(...data.map(d => getVal(d.value)), 1);

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
      const clean = res.text.replace(/```json|```/g,'').trim();
      const s = clean.indexOf('{'); const e = clean.lastIndexOf('}');
      const parsed = JSON.parse(clean.slice(s, e+1));
      setData((parsed.data ?? []).map((d: any, i: number) => ({ ...d, color: COLORS[i%COLORS.length] })));
      setSummary(parsed.summary ?? '');
      setNarrative(parsed.narrative ?? '');
      setIntentState('responding');
      setTimeout(() => setIntentState('idle'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not analyze. Try a more specific query.');
      setIntentState('idle');
    } finally { setLoading(false); }
  }, [query, fileData, loading, setIntentState]);

  const chartTypes: { id: ChartType; icon: React.ReactNode; label: string }[] = [
    { id: 'bar', icon: <BarChart2 size={13}/>, label: 'Bar' },
    { id: 'pie', icon: <PieChart size={13}/>, label: 'Pie' },
    { id: 'line', icon: <TrendingUp size={13}/>, label: 'Line' },
    { id: 'table', icon: <Grid size={13}/>, label: 'Table' },
  ];

  const exportCSV = () => {
    const csv = 'Label,Value\n' + data.map(d => `"${d.label}",${d.value}`).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='analysis.csv'; a.click();
  };

  return (
    <div className="flex flex-col h-full px-4 py-5 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-500" />
          <h2 className="text-sm font-semibold">Analyst</h2>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept=".csv,.json,.txt,.tsv" />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-indigo-300 hover:text-indigo-600 transition-all">
            <Paperclip size={11} /> Feed data
          </button>
        </div>
      </div>

      {fileName && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 shrink-0">
          <span className="text-xs text-indigo-700 flex-1 truncate">📎 {fileName}</span>
          <button onClick={() => { setFileData(null); setFileName(''); }} className="text-indigo-400 hover:text-indigo-700"><X size={13} /></button>
        </div>
      )}

      <div className="shrink-0">
        <AmbientInput value={query} onChange={setQuery} onSubmit={handleAnalyze}
          placeholder={fileData ? 'What do you want to know about this data?' : 'What should I analyze? (topic, numbers, or a URL)'}
          isLoading={loading} />
      </div>

      {error && <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 shrink-0">{error}</p>}

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={22} className="text-indigo-400 animate-spin" />
            <span className="text-[11px] text-gray-400">Analyzing…</span>
          </div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {summary && (
            <p className="text-xs text-gray-700 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 leading-relaxed font-medium">{summary}</p>
          )}
          {narrative && <p className="text-xs text-gray-500 leading-relaxed px-1">{narrative}</p>}

          {/* Chart type + actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {chartTypes.map(ct => (
                <button key={ct.id} onClick={() => setChartType(ct.id)}
                  className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-all ${chartType===ct.id?'bg-indigo-500 text-white border-indigo-500':'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                  {ct.icon}{ct.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={handleAnalyze} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" title="Refresh"><RefreshCw size={12} /></button>
              <button onClick={exportCSV} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" title="Export CSV"><Download size={12} /></button>
            </div>
          </div>

          <div className="gia-card p-4 overflow-x-auto">
            {chartType === 'bar' && (
              <div className="space-y-2.5">
                {data.map(d => (
                  <div key={d.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-medium truncate max-w-[60%]">{d.label}</span>
                      <span className="text-gray-400 font-mono text-[11px]">{getVal(d.value).toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{width:`${(getVal(d.value)/max)*100}%`,background:d.color}} />
                    </div>
                  </div>
                ))}

              </div>
            )}
            {chartType === 'pie' && <PieChartSVG data={data} />}
            {chartType === 'line' && <LineChartSVG data={data} />}
            {chartType === 'table' && (
              <table className="w-full text-left border-collapse min-w-[300px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {Object.keys(data[0] || {}).filter(k => !['color','id'].includes(k)).map(k => (
                      <th key={k} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-1">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      {Object.entries(d).filter(([k]) => !['color','id'].includes(k)).map(([k, v], j) => (
                        <td key={j} className="text-xs text-gray-600 py-2.5 px-1 truncate max-w-[120px]">
                          {k === 'label' && <div className="w-1.5 h-1.5 rounded-full inline-block mr-2" style={{background:d.color}} />}
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Data table */}
          <div className="gia-card overflow-hidden">
            <div className="grid grid-cols-2 bg-gray-50 px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <span>Label</span><span className="text-right">Value</span>
            </div>
            {data.map(d => (
              <div key={d.label} className="grid grid-cols-2 px-4 py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-700 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{background:d.color}} />{d.label}
                </span>
                <span className="text-xs text-gray-500 font-mono text-right">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <BarChart2 size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-xs text-gray-400">Paste data, a URL, or ask about any topic.</p>
            <p className="text-[10px] text-gray-300 mt-1">CSV/JSON files supported.</p>
          </div>
        </div>
      )}
    </div>
  );
};
export default AnalystModule;
