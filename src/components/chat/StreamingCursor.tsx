import { useEffect, useMemo, useState } from 'react';
import { TOOL_META } from '../WorkLog';
import type { ThinkingPhase } from '../ThinkingStatus';

const PHASE_LABELS: Record<string, string> = {
  gathering: 'Sniffing around',
  analyzing: 'Squinting at it',
  coding: 'Cooking',
  writing: 'Spilling ink',
  searching: 'Googling stuff',
  planning: 'Drawing maps',
  reasoning: 'Big brain time',
  processing: 'Crunching bytes',
  idle: 'Ready',
};

const EXTRAS = [
  'Doing stuff or something',
  'Following the breadcrumbs',
  'Convincing the electrons',
  'Asking the right questions',
  'Trusting the process',
  'Vibing and coding',
  'Consulting the void',
  'Winging it (successfully)',
];

/**
 * Inline streaming cursor that tracks the end of the generated text, like
 * Claude's. The state of the app (thinking/acting) is already conveyed by the
 * FloatingOrb, so this stays a plain blinking caret; every few beats it
 * briefly tags what GIA is doing (phase label, running tool, or a silly
 * extra) and then fades back to the bare caret.
 */
export const StreamingCursor: React.FC<{ phase?: ThinkingPhase; currentTool?: string | null }> = ({ phase, currentTool }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1800);
    return () => clearInterval(iv);
  }, []);

  const label = useMemo(() => {
    const cycle = tick % 6;
    const phaseLabel = PHASE_LABELS[phase || ''] || 'GIA is thinking';
    const toolLabel = currentTool ? TOOL_META[currentTool]?.label : undefined;
    // Mostly a quiet phase label; the tool tag has priority while it runs;
    // one beat in six stays bare so it never feels noisy.
    if (cycle === 5) return null;
    if (toolLabel) return { text: toolLabel, highlight: true };
    if (cycle === 2) return { text: EXTRAS[Math.floor(tick / 6) % EXTRAS.length], highlight: false };
    return { text: phaseLabel, highlight: false };
  }, [tick, phase, currentTool]);

  return (
    <span className="inline-flex items-center gap-1.5 ml-1 align-middle max-w-full">
      <span className="stream-cursor">▋</span>
      {label && (
        <span
          className="stream-status-label px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none overflow-hidden max-w-[150px] text-ellipsis whitespace-nowrap"
          style={{
            color: label.highlight ? '#c4b5fd' : 'var(--gia-muted-2)',
            background: label.highlight ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.06)',
          }}
        >
          {label.text}
        </span>
      )}
    </span>
  );
};

export default StreamingCursor;