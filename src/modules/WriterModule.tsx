import { logger } from '../utils/logger';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PenLine, Copy, Check, Download, RefreshCw, Loader2, X } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { useMemoryStore } from '../store/useMemoryStore';
import { useWriterStore } from '../store/useWriterStore';
import AmbientInput from '../components/AmbientInput';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const FORMATS = ['Email', 'Essay', 'Blog Post', 'Report', 'Story', 'Cover Letter', 'Tweet Thread', 'Summary', 'Study Notes', 'Exam Answer'];
const WORD_PRESETS = [100, 200, 400, 800, 1200];

const WriterModule: React.FC = () => {
  const { prompt, draft, format, wordTarget, setPrompt, setDraft, setFormat, setWordTarget, clearDraft } = useWriterStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(true);
  const { setIntentState, addNotification } = useGiaStore(useShallow(s => ({
    setIntentState: s.setIntentState,
    addNotification: s.addNotification,
  })));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  const handleWrite = useCallback(async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true); setError(''); setIntentState('thinking');
    try {
      let accumulated = '';
      await GiaBrain.generate({
        prompt: text,
        systemPrompt: `You are an expert writer. Write a ${format} of approximately ${wordTarget} words. Use clean markdown formatting — **bold** for emphasis, headers where logical, bullet points for lists. Produce only the content, no preamble or meta-commentary. Be natural, engaging, and purpose-fit.`,
        temperature: 0.82,
        maxTokens: 2500,
        onStream: (chunk) => { accumulated += chunk; setDraft(accumulated); },
      });
      setIntentState('responding');
      timerRef.current = setTimeout(() => setIntentState('idle'), 2000);
      useMemoryStore.getState().addMemory({ key: 'writing_format', value: format, category: 'preference', tier: 'episodic', confidence: 0.4 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setIntentState('idle');
    } finally {
      setLoading(false);
    }
  }, [prompt, format, wordTarget, loading, setIntentState, setDraft]);

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      addNotification('Clipboard access denied. Use HTTPS or a supported browser.');
    }
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const exportDraft = async () => {
    try {
      const fileName = `${format.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
      await Filesystem.writeFile({
        path: fileName,
        data: draft,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      addNotification(`Draft exported to Documents: ${fileName}`);
    } catch (e) {
      logger.error('Export failed', e);
      const blob = new Blob([draft], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gia-draft-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      timerRef.current = setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2">
          <PenLine size={16} style={{ color: '#ec4899' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Writer</span>
        </div>
        {draft && (
          <div className="flex items-center gap-1.5">
            <button onClick={copyDraft} className="gia-btn gia-btn-ghost text-xs py-1 px-2 border-zinc-800">
              {copied ? <Check size={12} style={{ color: '#34d399' }} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={exportDraft} className="gia-btn gia-btn-ghost text-xs py-1 px-2 border-zinc-800">
              <Download size={12} /> Export
            </button>
            <button onClick={clearDraft} className="p-1.5 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {draft ? (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="gia-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setPreview(true)} className="text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                  style={{ background: preview ? 'rgba(236,72,153,0.15)' : 'transparent', color: preview ? '#ec4899' : 'var(--gia-muted)' }}>
                  Preview
                </button>
                <button onClick={() => setPreview(false)} className="text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                  style={{ background: !preview ? 'rgba(236,72,153,0.15)' : 'transparent', color: !preview ? '#ec4899' : 'var(--gia-muted)' }}>
                  Raw
                </button>
              </div>
              <button onClick={handleWrite} disabled={loading} className="gia-btn gia-btn-ghost text-xs py-1 px-2 border-zinc-800">
                {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Rewrite
              </button>
            </div>
            {preview
              ? <MarkdownRenderer content={draft} />
              : <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: 'var(--gia-text)' }}>{draft}</pre>
            }
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--gia-muted)' }}>Format</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className="text-xs px-3 py-1.5 rounded-xl border transition-all tap-feedback"
                  style={{
                    background: format === f ? 'rgba(236,72,153,0.15)' : 'var(--gia-surface)',
                    border: `1px solid ${format === f ? 'rgba(236,72,153,0.3)' : 'var(--gia-border)'}`,
                    color: format === f ? '#ec4899' : 'var(--gia-muted)',
                    fontWeight: format === f ? 600 : 400,
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--gia-muted)' }}>
              Target Length: ~{wordTarget} words
            </p>
            <div className="flex items-center gap-2">
              <input type="range" min={50} max={2000} step={50} value={wordTarget}
                onChange={e => setWordTarget(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: '#ec4899' }} />
              <div className="flex gap-1">
                {WORD_PRESETS.map(w => (
                  <button key={w} onClick={() => setWordTarget(w)}
                    className="text-[10px] px-2 py-1 rounded-lg border transition-all border-zinc-800"
                    style={{
                      background: wordTarget === w ? 'rgba(236,72,153,0.15)' : 'var(--gia-surface)',
                      color: wordTarget === w ? '#ec4899' : 'var(--gia-muted)',
                    }}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && (
            <div className="gia-card p-3" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
              <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
            </div>
          )}
        </div>
      )}

      <div className="px-4 pb-5 pt-2 shrink-0">
        <AmbientInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleWrite}
          isLoading={loading}
          placeholder={`Describe what to write as a ${format}…`}
        />
      </div>
    </div>
  );
};

export default WriterModule;
