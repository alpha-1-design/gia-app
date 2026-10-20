import React, { useState } from 'react';
import { X, Hammer, MonitorPlay, Sparkles } from 'lucide-react';
import { StyleCarousel } from './StyleCarousel';
import { BUILD_STARTERS, BUILD_STYLES, composeBuildPrompt, findBuildStyle } from '../config/buildStyles';
import { useGiaStore } from '../store/useGiaStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called when a starter is chosen, so the host can switch on Build mode. */
  onPick?: () => void;
}

/** A studio: a live style stage, a brief, and starters that land in the composer. */
export const BuildStudio: React.FC<Props> = ({ isOpen, onClose, onPick }) => {
  const styleId = useGiaStore(s => s.buildStyleId);
  const reduceMotion = useGiaStore(s => s.reduceMotion);
  const previewUrl = useGiaStore(s => s.buildPreviewUrl);
  const projectPath = useGiaStore(s => s.activeProjectPath);
  const [brief, setBrief] = useState('');
  if (!isOpen) return null;
  const style = findBuildStyle(styleId) ?? BUILD_STYLES[0];
  const projectName = projectPath?.split('/').filter(Boolean).pop();

  const start = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    onPick?.();
    useGiaStore.getState().setPendingInput(composeBuildPrompt(text, style), { autoSend: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.78)' }} role="dialog" aria-modal="true" aria-labelledby="studio-title">
      <div className="w-full sm:max-w-3xl h-[94dvh] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="min-w-0">
            <h2 id="studio-title" className="text-[15px] font-semibold text-white flex items-center gap-2"><Hammer size={15} aria-hidden /> Build Studio</h2>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: '#a1a1aa' }}>
              {projectName ? `Project · ${projectName}` : 'Pick a look, write a brief, and GIA builds it in the sandbox.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#050505' }}>
            <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#3f3f46' }} />
              <span className="w-2 h-2 rounded-full" style={{ background: '#3f3f46' }} />
              <span className="w-2 h-2 rounded-full" style={{ background: '#3f3f46' }} />
              <span className="ml-2 text-[10px] truncate" style={{ color: '#71717a' }}>{previewUrl || 'preview.local'}</span>
              {previewUrl && <MonitorPlay size={12} className="ml-auto shrink-0" style={{ color: '#34d399' }} />}
            </div>
            <div className="p-4 min-h-[148px]" style={{ background: style.id === 'soft-pastel' || style.id === 'brutalist' || style.id === 'editorial' || style.id === 'corporate' ? '#fafafa' : '#000' }}>
              <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: `rgb(${style.rgb})` }}>{style.tagline}</div>
              <div className="mt-2 text-lg font-semibold" style={{ color: style.id === 'soft-pastel' || style.id === 'brutalist' || style.id === 'editorial' || style.id === 'corporate' ? '#18181b' : '#fafafa' }}>
                {style.label}
              </div>
              <div className="mt-3 flex gap-2">
                <span className="h-8 px-3 rounded-lg text-[11px] inline-flex items-center font-medium" style={{ background: `rgba(${style.rgb},0.9)`, color: '#09090b' }}>Primary</span>
                <span className="h-8 px-3 rounded-lg text-[11px] inline-flex items-center" style={{ border: `1px solid rgba(${style.rgb},0.45)`, color: `rgb(${style.rgb})` }}>Secondary</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-10 rounded-lg" style={{ background: `rgba(${style.rgb},${0.08 + i * 0.06})`, border: `1px solid rgba(${style.rgb},0.25)` }} />
                ))}
              </div>
            </div>
          </div>

          <StyleCarousel
            styles={BUILD_STYLES}
            selectedId={style.id}
            onSelect={id => useGiaStore.getState().setBuildStyleId(id)}
            flat={reduceMotion}
          />
          <div aria-live="polite">
            <div className="text-sm font-semibold text-white">{style.label}</div>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: '#a1a1aa' }}>{style.directive}</p>
          </div>

          <div>
            <label htmlFor="studio-brief" className="text-[10px] uppercase tracking-wider" style={{ color: '#71717a' }}>Brief</label>
            <textarea
              id="studio-brief"
              value={brief}
              onChange={e => setBrief(e.target.value)}
              rows={3}
              placeholder="Describe the app. The selected style is added for you."
              className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px] outline-none resize-none"
              style={{ background: '#0a0a0a', color: '#fafafa', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              type="button"
              disabled={!brief.trim()}
              onClick={() => start(brief)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium disabled:opacity-40"
              style={{ background: '#fafafa', color: '#09090b' }}
            >
              <Sparkles size={13} /> Start build
            </button>
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#71717a' }}>Start from</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BUILD_STARTERS.map(st => (
                <button
                  key={st.id}
                  onClick={() => start(st.prompt)}
                  className="text-left rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="text-sm font-medium text-white">{st.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#a1a1aa' }}>{st.summary}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};