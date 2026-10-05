export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'acting';

export interface OrbInputs {
  voiceState: 'off' | 'listening' | 'hearing';
  speaking: boolean;
  currentTool: string | null;
  thinkingPhase: string;
}

/**
 * What the orb should show. Order matters: the user's own voice always wins,
 * then GIA talking, then a tool running, then plain thinking.
 */
export function deriveOrbState(i: OrbInputs): OrbState {
  if (i.voiceState === 'hearing' || i.voiceState === 'listening') return 'listening';
  if (i.speaking) return 'speaking';
  if (i.currentTool) return 'acting';
  if (i.thinkingPhase && i.thinkingPhase !== 'idle') return 'thinking';
  return 'idle';
}

export const ORB_LABELS: Record<OrbState, string> = {
  idle: 'GIA is ready',
  listening: 'GIA is listening',
  thinking: 'GIA is thinking',
  speaking: 'GIA is speaking',
  acting: 'GIA is working',
};
