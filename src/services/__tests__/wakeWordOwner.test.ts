import { describe, it, expect } from 'vitest';
import { claimWakeWord, wakeWordIsClaimed } from '../wakeWordOwner';

describe('wakeWordOwner', () => {
  it('is claimed only while a claim is held', () => {
    expect(wakeWordIsClaimed()).toBe(false);
    const release = claimWakeWord();
    expect(wakeWordIsClaimed()).toBe(true);
    release();
    expect(wakeWordIsClaimed()).toBe(false);
  });
  it('releasing twice does not steal another owner\'s claim', () => {
    const a = claimWakeWord();
    const b = claimWakeWord();
    a(); a();
    expect(wakeWordIsClaimed()).toBe(true);
    b();
    expect(wakeWordIsClaimed()).toBe(false);
  });
});
