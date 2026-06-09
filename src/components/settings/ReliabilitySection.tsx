import React from 'react';
import { ShieldCheck, Brain, Repeat, Wifi, FileCheck } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';

interface ToggleRowProps {
  label: string;
  desc: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, desc, icon, enabled, onToggle }) => (
  <div className="flex items-start gap-3 py-2">
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: enabled ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${enabled ? 'rgba(52,211,153,0.2)' : 'transparent'}` }}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>{label}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{desc}</p>
    </div>
    <button
      onClick={() => onToggle(!enabled)}
      className="w-9 h-5 rounded-full shrink-0 transition-all tap-feedback relative"
      style={{ background: enabled ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)', border: `1px solid ${enabled ? 'rgba(52,211,153,0.4)' : 'transparent'}` }}
    >
      <div className="w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all"
        style={{ left: enabled ? '18px' : '3px', background: enabled ? '#34d399' : 'rgba(255,255,255,0.3)' }} />
    </button>
  </div>
);

export const ReliabilitySection: React.FC = () => {
  const {
    inputGuardrails, setInputGuardrails,
    outputValidation, setOutputValidation,
    responseCache, setResponseCache,
    smartFallback, setSmartFallback,
    localSummarize, setLocalSummarize,
  } = useGiaStore();

  return (
    <div className="gia-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={14} style={{ color: '#34d399' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Reliability
        </span>
      </div>
      <p className="text-[10px] mb-1" style={{ color: 'var(--gia-muted-2)' }}>
        Local AI fallbacks + safety nets when providers are flaky
      </p>
      <div className="mt-1 space-y-0.5">
        <ToggleRow
          label="Smart Fallback"
          desc="Auto-route to healthiest provider on failure"
          icon={<Repeat size={13} style={{ color: smartFallback ? '#34d399' : 'var(--gia-muted)' }} />}
          enabled={smartFallback} onToggle={setSmartFallback}
        />
        <ToggleRow
          label="Response Cache"
          desc="Reuse recent identical responses (no redundant API calls)"
          icon={<Wifi size={13} style={{ color: responseCache ? '#34d399' : 'var(--gia-muted)' }} />}
          enabled={responseCache} onToggle={setResponseCache}
        />
        <ToggleRow
          label="Input Guardrails"
          desc="Block prompt injection and dangerous commands"
          icon={<ShieldCheck size={13} style={{ color: inputGuardrails ? '#34d399' : 'var(--gia-muted)' }} />}
          enabled={inputGuardrails} onToggle={setInputGuardrails}
        />
        <ToggleRow
          label="Output Validation"
          desc="Auto-repair broken JSON, fences, and repeated text"
          icon={<FileCheck size={13} style={{ color: outputValidation ? '#34d399' : 'var(--gia-muted)' }} />}
          enabled={outputValidation} onToggle={setOutputValidation}
        />
        <ToggleRow
          label="Local Summarization"
          desc="Summarize long contexts on-device (HuggingFace)"
          icon={<Brain size={13} style={{ color: localSummarize ? '#34d399' : 'var(--gia-muted)' }} />}
          enabled={localSummarize} onToggle={setLocalSummarize}
        />
      </div>
    </div>
  );
};
