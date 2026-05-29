import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, Play, RotateCcw, Download, Loader2, AlertCircle } from 'lucide-react';
import CodeRunner, { CodeRunResult } from '../services/CodeRunner';

interface Props {
  lang: string;
  code: string;
  showRun?: boolean;
}

const CodeBlock: React.FC<Props> = ({ lang, code, showRun = true }) => {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodeRunResult | null>(null);
  const [autoFixAttempt, setAutoFixAttempt] = useState(0);
  const [currentCode, setCurrentCode] = useState(code);
  const [showDiff, setShowDiff] = useState(false);
  const fixedCodesRef = useRef(new Set<string>());
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }; }, []);

  const copy = () => {
    navigator.clipboard.writeText(currentCode).catch(() => console.warn('Clipboard write failed'));
    setCopied(true);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const extMap: Record<string, string> = { javascript: 'js', typescript: 'ts' };
    const ext = extMap[lang] || lang || 'txt';
    const mimeMap: Record<string, string> = { js: 'text/javascript', ts: 'text/typescript', py: 'text/x-python', md: 'text/markdown', json: 'application/json', html: 'text/html', css: 'text/css' };
    const mime = mimeMap[ext] || 'text/plain';
    const blob = new Blob([currentCode], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gia-code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    copyTimerRef.current = setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);

    try {
      const res = await CodeRunner.run({ language: lang, code: currentCode });
      setResult(res);

      if (res.error && res.exitCode !== 0 && autoFixAttempt < 2) {
        setAutoFixAttempt(prev => prev + 1);
        if (fixedCodesRef.current.has(currentCode)) return;
        fixedCodesRef.current.add(currentCode);
        const fixed = await CodeRunner.autoFix(currentCode, lang, res.error);
        if (fixed && fixed !== currentCode && !fixedCodesRef.current.has(fixed)) {
          setCurrentCode(fixed);
          setShowDiff(true);
        }
      }
    } catch (e) {
      setResult({
        output: '',
        error: e instanceof Error ? e.message : 'Execution failed',
        exitCode: 1,
        language: lang,
        version: '',
      });
    } finally {
      setRunning(false);
    }
  };

  const canRun = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'rust', 'ruby', 'php', 'bash', 'r', 'sql', 'kotlin', 'swift'].includes(lang?.toLowerCase());

  return (
    <div className="code-block my-3">
      <div className="code-block-header">
        <div className="flex items-center gap-2">
          <span className="code-block-lang">{lang || 'code'}</span>
          {showDiff && (
            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
              Auto-fixed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {canRun && showRun && (
            <button onClick={handleRun} disabled={running}
              className="flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded"
              style={{ fontSize: '10px', color: running ? '#f59e0b' : 'var(--gia-muted)' }}>
              {running ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
              {running ? 'Running...' : 'Run'}
            </button>
          )}
          <button onClick={download} className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '10px', color: 'var(--gia-muted)' }}>
            <Download size={10} />
          </button>
          <button onClick={copy} className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '10px', color: copied ? '#34d399' : 'var(--gia-muted)' }}>
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="code-block-body"><code>{currentCode}</code></pre>

      {result && (
        <div className="border-t" style={{ borderColor: 'var(--gia-border)' }}>
          {/* Output */}
          {result.output && (
            <div className="p-3" style={{ background: '#0d0d14' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Play size={9} style={{ color: '#34d399' }} />
                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#34d399' }}>Output</span>
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed" style={{ color: '#e2e8f0', maxHeight: '200px', overflow: 'auto' }}>
                {result.output}
              </pre>
            </div>
          )}
          {/* Error */}
          {result.error && (
            <div className="p-3" style={{ background: '#0d0d14', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle size={9} style={{ color: '#f87171' }} />
                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#f87171' }}>Error (Exit {result.exitCode})</span>
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed" style={{ color: '#f87171', maxHeight: '200px', overflow: 'auto' }}>
                {result.error}
              </pre>
              {autoFixAttempt > 0 && autoFixAttempt < 3 && (
                <div className="flex items-center gap-1.5 mt-2 text-[10px]" style={{ color: '#f59e0b' }}>
                  <RotateCcw size={10} />
                  Auto-fix attempt {autoFixAttempt}/3...
                </div>
              )}
              {autoFixAttempt >= 3 && (
                <div className="flex items-center gap-1.5 mt-2 text-[10px]" style={{ color: '#f87171' }}>
                  Max auto-fix attempts reached. Try fixing manually.
                </div>
              )}
            </div>
          )}
          {/* Exit code & version */}
          <div className="flex items-center gap-3 px-3 py-1.5" style={{ background: 'var(--gia-surface-3)', borderTop: '1px solid var(--gia-border)' }}>
            <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
              Exit: {result.exitCode}
            </span>
            {result.version && (
              <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
                {result.language} {result.version}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(CodeBlock);
