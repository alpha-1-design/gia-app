import React from 'react';
import { Trash2, ArrowUp, Loader2 } from 'lucide-react';
import { BAR_COUNT, type VoiceNoteState } from '../hooks/useVoiceNote';
import { formatDuration } from '../utils/waveform';

interface Props {
  state: Exclude<VoiceNoteState, 'idle'>;
  elapsed: number;
  levels: number[];
  status: string;
  onCancel: () => void;
  onSend: () => void;
  reduceMotion?: boolean;
}

/** Replaces the composer while a voice note is being recorded. */
export const VoiceNoteBar: React.FC<Props> = ({ state, elapsed, levels, status, onCancel, onSend, reduceMotion }) => {
  const recording = state === 'recording';
  // Pad on the left so bars enter from the right and scroll left, like WhatsApp.
  const bars = [...Array(Math.max(0, BAR_COUNT - levels.length)).fill(0), ...levels];

  return (
    <div
      role="group"
      aria-label={recording ? 'Recording voice note' : 'Transcribing voice note'}
      className="flex items-center gap-3 px-3 py-2 rounded-full"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={!recording}
        aria-label="Discard voice note"
        className="p-2 rounded-full disabled:opacity-40"
        style={{ color: '#f87171' }}
      >
        <Trash2 size={18} />
      </button>

      <span className="flex items-center gap-2 text-xs tabular-nums shrink-0" style={{ color: 'var(--gia-text)' }}>
        <span
          className={recording && !reduceMotion ? 'animate-pulse' : undefined}
          style={{ width: 8, height: 8, borderRadius: 999, background: recording ? '#ef4444' : '#a3a3a3' }}
          aria-hidden
        />
        {recording ? formatDuration(elapsed) : status || 'Working…'}
      </span>

      <div className="flex-1 flex items-center justify-between gap-[2px] h-8 min-w-0" aria-hidden>
        {bars.map((v, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: `${Math.max(12, v * 100)}%`,
              background: recording ? 'var(--gia-accent)' : 'rgba(255,255,255,0.2)',
              opacity: 0.35 + 0.65 * (i / BAR_COUNT),
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onSend}
        disabled={!recording}
        aria-label="Send voice note"
        className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-60"
        style={{ background: 'var(--gia-accent)', color: '#000' }}
      >
        {recording ? <ArrowUp size={18} /> : <Loader2 size={18} className={reduceMotion ? undefined : 'animate-spin'} />}
      </button>
    </div>
  );
};
