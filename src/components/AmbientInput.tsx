import React, { useRef, useEffect } from 'react';
import { Send, Loader2, Square, Mic, MicOff } from 'lucide-react';
import { useGiaStore, IntentState } from '../store/useGiaStore';


interface AmbientInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  onVoiceToggle?: () => void;
  isVoiceListening?: boolean;
  isVoiceRefining?: boolean;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  multiline?: boolean;
  autoFocus?: boolean;
  prefix?: React.ReactNode;
}

const STATE_GLOW: Record<IntentState, string> = {
  idle:       '168, 85, 247',
  typing:     '168, 85, 247',
  analyst:    '59, 130, 246',
  writer:     '236, 72, 153',
  planner:    '16, 185, 129',
  thinking:   '251, 191, 36',
  responding: '34, 197, 94',
};

const AmbientInput: React.FC<AmbientInputProps> = ({
  value, onChange, onSubmit, onStop,
  onVoiceToggle, isVoiceListening, isVoiceRefining,
  placeholder = 'Message GIA…',
  disabled = false,
  isLoading = false,
  multiline = false,
  prefix,
}) => {
  const intentState = useGiaStore(s => s.intentState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const color = STATE_GLOW[intentState] ?? STATE_GLOW.idle;
  const isActive = intentState !== 'idle' || value.length > 0;

  // Auto-resize textarea
  useEffect(() => {
    if (multiline && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [value, multiline]);

  const justPastedRef = useRef(false);

  const handlePasteCapture = () => {
    justPastedRef.current = true;
    // Some Android WebView keyboards emit a synthetic Enter keydown while
    // committing pasted multi-line text. Give that a moment to land before
    // trusting Enter again, so a paste can never masquerade as "send".
    setTimeout(() => { justPastedRef.current = false; }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (justPastedRef.current) return;
    const isCmdEnter = e.key === 'Enter' && (e.metaKey || e.ctrlKey);
    const isPlainEnter = e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey;
    if (isPlainEnter || isCmdEnter) {
      e.preventDefault();
      if (!value.trim() || isLoading || disabled) return;
      onSubmit();
    }
  };

  const borderColor = isActive
    ? `rgba(${color}, 0.35)`
    : 'rgba(255,255,255,0.08)';

  const boxShadow = isLoading
    ? `0 0 0 2px rgba(${color}, 0.2), 0 0 20px rgba(${color}, 0.15)`
    : isActive
    ? `0 0 0 1px rgba(${color}, 0.15), 0 2px 12px rgba(0,0,0,0.3)`
    : '0 2px 12px rgba(0,0,0,0.3)';

  const sharedInputProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onKeyDown: handleKeyDown,
    onPasteCapture: handlePasteCapture,
    placeholder,
    disabled: disabled || isLoading,
    autoComplete: 'on',
    autoCorrect: 'on',
    autoCapitalize: 'sentences' as const,
    spellCheck: true,
    inputMode: 'text' as const,
    style: {
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${borderColor}`,
      boxShadow,
      color: 'var(--gia-text)',
      borderRadius: multiline ? '18px' : '999px',
      transition: 'all 0.25s ease',
      caretColor: `rgba(${color}, 1)`,
    },
  };

  return (
    <div className="relative w-full">
      <div
        className="absolute -inset-2 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, rgba(${color}, ${isLoading ? 0.18 : isActive ? 0.1 : 0.05}) 0%, transparent 70%)`,
          filter: 'blur(20px)',
          transition: 'all 0.4s ease',
        }}
      />

      <div className="relative flex items-end gap-2">
        {prefix && (
          <div className="absolute left-3 bottom-2.5 z-10 flex items-center">
            {prefix}
          </div>
        )}
        {multiline ? (
          <textarea
            ref={textareaRef}
            {...sharedInputProps}
            rows={1}
            className="flex-1 py-3 pl-11 pr-12 text-sm outline-none placeholder:opacity-40 resize-none"
            style={{
              ...sharedInputProps.style,
              minHeight: '48px',
              maxHeight: '120px',
              overflow: 'auto',
              overflowWrap: 'break-word',
              paddingLeft: prefix ? '60px' : undefined,
            }}
          />
        ) : (
          <input
            ref={inputRef}
            {...sharedInputProps}
            type="text"
            className="flex-1 py-3.5 pl-11 pr-14 text-sm outline-none placeholder:opacity-40"
            style={{ paddingLeft: prefix ? '60px' : undefined }}
          />
        )}

        {/* Mic button — delegates to parent voice control */}
        {onVoiceToggle && (
          <button
            type="button"
            onClick={onVoiceToggle}
            className="absolute left-1.5 bottom-1.5 w-10 h-10 rounded-full flex items-center justify-center transition-all"
            style={{ color: isVoiceListening ? '#f87171' : 'var(--gia-muted)' }}
          >
            {isVoiceListening ? <Mic size={17} className="animate-pulse" /> : <MicOff size={17} />}
          </button>
        )}

        {/* Refinement Indicator */}
        {isVoiceRefining && (
          <div className="absolute left-12 top-1 flex items-center gap-1.5 animate-pulse">
            <Loader2 size={10} className="animate-spin text-emerald-400" />
            <span className="text-[8px] text-emerald-400 font-medium">Polishing...</span>
          </div>
        )}

        {/* Send / Stop button */}
        <button
          type="button"
          onClick={isLoading && onStop ? onStop : onSubmit}
          disabled={!isLoading && (!value.trim() || disabled)}
          className="absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
          style={{
            background: isLoading
              ? 'rgba(239, 68, 68, 0.8)'
              : value.trim()
              ? `rgb(${color})`
              : 'rgba(255,255,255,0.08)',
            transform: value.trim() || isLoading ? 'scale(1)' : 'scale(0.85)',
          }}
        >
          {isLoading
            ? onStop
              ? <Square size={12} className="text-white fill-white" />
              : <Loader2 size={14} className="text-white animate-spin" />
            : <Send size={13} className="text-white" style={{ transform: 'translateX(1px)' }} />
          }
        </button>
      </div>
    </div>
  );
};

export default AmbientInput;
