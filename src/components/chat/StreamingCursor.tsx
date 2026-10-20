import { TOOL_META } from '../WorkLog';
import { statusLabel, type ThinkingPhase } from '../ThinkingStatus';

/**
 * A caret that stays put. The status beside it is the current tool or phase
 * and does not rotate through joke lines.
 */
export const StreamingCursor: React.FC<{ phase?: ThinkingPhase; currentTool?: string | null }> = ({ phase, currentTool }) => {
  const toolLabel = currentTool ? TOOL_META[currentTool]?.label : undefined;
  const text = toolLabel || (phase ? statusLabel(phase) : null);
  return (
    <span className="inline-flex items-center gap-1.5 ml-1 align-middle max-w-full">
      <span className="stream-cursor">▋</span>
      {text && (
        <span className="text-[12px] leading-none truncate" style={{ color: '#a1a1aa' }}>
          {text}
        </span>
      )}
    </span>
  );
};

export default StreamingCursor;