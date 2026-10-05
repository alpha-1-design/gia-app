import { describe, it, expect } from 'vitest';
import { deriveOrbState } from '../orbState';

const base = { voiceState: 'off', speaking: false, currentTool: null, thinkingPhase: 'idle' } as const;

describe('deriveOrbState', () => {
  it('is idle when nothing is happening', () => {
    expect(deriveOrbState(base)).toBe('idle');
  });
  it('shows thinking for any non-idle phase', () => {
    expect(deriveOrbState({ ...base, thinkingPhase: 'reasoning' })).toBe('thinking');
  });
  it('a running tool beats thinking', () => {
    expect(deriveOrbState({ ...base, thinkingPhase: 'searching', currentTool: 'web_search' })).toBe('acting');
  });
  it('speaking beats a running tool', () => {
    expect(deriveOrbState({ ...base, speaking: true, currentTool: 'web_search' })).toBe('speaking');
  });
  it('the user talking beats everything', () => {
    expect(deriveOrbState({ voiceState: 'hearing', speaking: true, currentTool: 'x', thinkingPhase: 'writing' })).toBe('listening');
    expect(deriveOrbState({ ...base, voiceState: 'listening' })).toBe('listening');
  });
});
