import React, { useRef, useEffect, useState } from 'react';
import { Send, Loader2, Square, Mic, MicOff, Sparkles } from 'lucide-react';
import { useGiaStore, IntentState } from '../store/useGiaStore';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import GiaBrain from '../services/GiaBrain';

interface AmbientInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  multiline?: boolean;
  autoFocus?: boolean;
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
  placeholder = 'Message GIA…',
  disabled = false,
  isLoading = false,
  multiline = false,
  autoFocus = false,
}) => {
  const { intentState, addNotification } = useGiaStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  const color = STATE_GLOW[intentState] ?? STATE_GLOW.idle;
  const isActive = intentState !== 'idle' || value.length > 0;

  const toggleListening = async () => {
    if (isListening) {
      await SpeechRecognition.stop();
      setIsListening(false);
      return;
    }

    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        addNotification('Speech recognition not available.');
        return;
      }

      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        addNotification('Microphone permission denied.');
        return;
      }

      setIsListening(true);
      const result = await SpeechRecognition.start({
        language: 'en-US',
        partialResults: true,
        popup: true,
      });

      if (result.matches && result.matches.length > 0) {
        const transcript = result.matches[0];
        onChange(transcript);
        
        // Auto-refine if it's long enough
        if (transcript.split(' ').length > 5) {
          refineSpeech(transcript);
        }
      }
    } catch (e) {
      console.error(e);
      setIsListening(false);
    } finally {
      setIsListening(false);
    }
  };

  const refineSpeech = async (text: string) => {
    setIsRefining(true);
    try {
      const res = await GiaBrain.generate({
        prompt: text,
        systemPrompt: "You are a speech correction assistant. Fix any obvious typos, misheard words, or grammar issues in the provided transcript while keeping the user's intent identical. Respond ONLY with the corrected text, no explanations.",
        temperature: 0.1,
        maxTokens: 500,
      });
      if (res.text) onChange(res.text.trim());
    } catch (e) {
      console.error('Refinement failed', e);
    } finally {
      setIsRefining(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (multiline && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [value, multiline]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
      {/* Ambient glow beneath input */}
      <div
        className="absolute -inset-2 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, rgba(${color}, ${isLoading ? 0.18 : isActive ? 0.1 : 0.05}) 0%, transparent 70%)`,
          filter: 'blur(20px)',
          transition: 'all 0.4s ease',
        }}
      />

      <div className="relative flex items-end gap-2">
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
            }}
          />
        ) : (
          <input
            ref={inputRef}
            {...sharedInputProps}
            type="text"
            className="flex-1 py-3.5 pl-11 pr-14 text-sm outline-none placeholder:opacity-40"
          />
        )}

        {/* Mic button */}
        <button
          type="button"
          onClick={toggleListening}
          className="absolute left-1.5 bottom-1.5 w-10 h-10 rounded-full flex items-center justify-center transition-all"
          style={{ color: isListening ? '#f87171' : 'var(--gia-muted)' }}
        >
          {isListening ? <MicOff size={17} className="animate-pulse" /> : <Mic size={17} />}
        </button>

        {/* Refinement Indicator */}
        {isRefining && (
          <div className="absolute left-12 top-1 flex items-center gap-1.5 animate-pulse">
            <Sparkles size={10} className="text-emerald-400" />
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
