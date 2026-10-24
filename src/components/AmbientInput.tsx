import { extractLargeInsertion } from '../utils/pasteDetect';
import React, { useRef, useEffect } from 'react';
import { Send, Loader2, Square, Mic, MicOff } from 'lucide-react';


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
  /** A big block of text arrived in one change (IME paste). Receives the block; the field keeps the rest. */
  onLargeInsert?: (text: string) => void;
  autoFocus?: boolean;
  prefix?: React.ReactNode;
}

const AmbientInput: React.FC<AmbientInputProps> = ({
  value, onChange, onSubmit, onStop,
  onVoiceToggle, isVoiceListening, isVoiceRefining,
  placeholder = 'Message GIA…',
  disabled = false,
  isLoading = false,
  multiline = false,
  onLargeInsert,
  prefix,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = value.length > 0;

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
    ? 'rgba(var(--gia-accent-rgb), 0.35)'
    : 'var(--gia-border-2)';

  const boxShadow = isLoading
    ? '0 0 0 1px rgba(var(--gia-accent-rgb), 0.25)'
    : '0 2px 12px rgba(0,0,0,0.18)';

  const sharedInputProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value;
      const big = onLargeInsert ? extractLargeInsertion(value, next) : null;
      if (big && onLargeInsert) {
        onLargeInsert(big.inserted);
        onChange(big.remaining);
      } else {
        onChange(next);
      }
    },
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
      background: 'var(--gia-surface-2)',
      border: `1px solid ${borderColor}`,
      boxShadow,
      color: 'var(--gia-text)',
      borderRadius: multiline ? '18px' : '999px',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      caretColor: 'var(--gia-accent)',
    },
  };

  return (
    <div className="relative w-full">
      <div className="flex items-end gap-2">
        {prefix && (
          <div className="shrink-0 self-center">
            {prefix}
          </div>
        )}
        <div className="relative flex-1 min-w-0">
          {multiline ? (
            <textarea
              ref={textareaRef}
              {...sharedInputProps}
              rows={1}
              className="w-full py-3 pl-11 pr-12 text-sm outline-none placeholder:opacity-40 resize-none"
              style={{
                ...sharedInputProps.style,
                minHeight: '48px',
                maxHeight: '120px',
                overflow: 'auto',
                overflowWrap: 'break-word',
              }}
            />
          ) : (
            <input
              ref={inputRef}
              {...sharedInputProps}
              type="text"
              className="w-full py-3.5 pl-11 pr-14 text-sm outline-none placeholder:opacity-40"
            />
          )}

          {/* Mic button — delegates to parent voice control */}
          {onVoiceToggle && (
            <button
              type="button"
              onClick={onVoiceToggle}
              aria-label={isVoiceListening ? 'Stop voice input' : 'Start voice input'}
              className="absolute left-1.5 bottom-1.5 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ color: isVoiceListening ? 'var(--gia-accent)' : 'var(--gia-muted)' }}
            >
              {isVoiceListening ? <Mic size={17} className="animate-pulse" /> : <MicOff size={17} />}
            </button>
          )}

          {/* Refinement Indicator */}
          {isVoiceRefining && (
            <div className="absolute left-12 top-1 flex items-center gap-1.5 animate-pulse" style={{ color: 'var(--gia-muted)' }}>
              <Loader2 size={10} className="animate-spin" />
              <span className="text-[8px] font-medium">Polishing...</span>
            </div>
          )}

          {/* Send / Stop button */}
          <button
            type="button"
            onClick={isLoading && onStop ? onStop : onSubmit}
            aria-label={isLoading ? 'Stop generating' : 'Send message'}
            disabled={!isLoading && (!value.trim() || disabled)}
            className="absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: isLoading || !value.trim() ? 'var(--gia-surface-3)' : 'var(--gia-accent)',
              color: isLoading ? 'var(--gia-text)' : value.trim() ? '#000' : 'var(--gia-muted)',
              transform: value.trim() || isLoading ? 'scale(1)' : 'scale(0.85)',
            }}
          >
            {isLoading
              ? onStop
                ? <Square size={12} style={{ fill: 'currentColor' }} />
                : <Loader2 size={14} className="animate-spin" />
              : <Send size={13} style={{ transform: 'translateX(1px)' }} />
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default AmbientInput;
