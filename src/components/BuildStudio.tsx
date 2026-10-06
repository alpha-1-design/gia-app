import React from 'react';
import { X, Hammer } from 'lucide-react';
import { StyleCarousel } from './StyleCarousel';
import { BUILD_STARTERS, BUILD_STYLES, composeBuildPrompt, findBuildStyle } from '../config/buildStyles';
import { useGiaStore } from '../store/useGiaStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called when a starter is chosen, so the host can switch on Build mode. */
  onPick?: () => void;
}

/** Pick a look, pick something to build, and the composer is filled in for you. */
export const BuildStudio: React.FC<Props> = ({ isOpen, onClose, onPick }) => {
  const styleId = useGiaStore(s => s.buildStyleId);
  const reduceMotion = useGiaStore(s => s.reduceMotion);
  if (!isOpen) return null;
  const style = findBuildStyle(styleId) ?? BUILD_STYLES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} role="dialog" aria-modal="true" aria-labelledby="studio-title">
      <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="p-4 flex items-start justify-between gap-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 id="studio-title" className="text-base font-semibold text-white flex items-center gap-2"><Hammer size={15} aria-hidden /> Build Studio</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>Choose a look, then something to build. The style is added to your prompt.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--gia-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          <StyleCarousel
            styles={BUILD_STYLES}
            selectedId={style.id}
            onSelect={id => useGiaStore.getState().setBuildStyleId(id)}
            flat={reduceMotion}
          />
          <div className="text-center mt-1 mb-4" aria-live="polite">
            <div className="text-sm font-semibold" style={{ color: `rgb(${style.rgb})` }}>{style.label}</div>
            <p className="text-[11px] mt-1 px-2" style={{ color: 'var(--gia-muted)' }}>{style.directive}</p>
          </div>

          <h3 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--gia-muted)' }}>Start from</h3>
          <div className="flex flex-col gap-2">
            {BUILD_STARTERS.map(st => (
              <button
                key={st.id}
                onClick={() => {
                  onPick?.();
                  useGiaStore.getState().setPendingInput(composeBuildPrompt(st.prompt, style), { autoSend: false });
                  onClose();
                }}
                className="text-left rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="text-sm font-medium text-white">{st.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{st.summary}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
