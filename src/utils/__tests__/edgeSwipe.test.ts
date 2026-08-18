import { describe, it, expect } from 'vitest';
import { beginEdgeSwipe, shouldOpenFromEdgeSwipe } from '../edgeSwipe';

describe('beginEdgeSwipe', () => {
  it('starts tracking when the touch begins within the left edge zone', () => {
    expect(beginEdgeSwipe(10, 200)).toEqual({ startX: 10, startY: 200 });
    expect(beginEdgeSwipe(0, 50)).toEqual({ startX: 0, startY: 50 });
    expect(beginEdgeSwipe(24, 50)).toEqual({ startX: 24, startY: 50 });
  });

  it('does not track a touch that starts away from the edge (this was the point -- a normal tap/scroll anywhere else must not trigger it)', () => {
    expect(beginEdgeSwipe(25, 200)).toBeNull();
    expect(beginEdgeSwipe(100, 200)).toBeNull();
    expect(beginEdgeSwipe(360, 200)).toBeNull();
  });
});

describe('shouldOpenFromEdgeSwipe', () => {
  const state = { startX: 5, startY: 200 };

  it('opens once the swipe moves right past the distance threshold with a mostly-horizontal path', () => {
    expect(shouldOpenFromEdgeSwipe(state, 70, 205)).toBe(true);
  });

  it('does not open for a small movement', () => {
    expect(shouldOpenFromEdgeSwipe(state, 30, 200)).toBe(false);
  });

  it('does not open for a leftward or stationary movement', () => {
    expect(shouldOpenFromEdgeSwipe(state, 0, 200)).toBe(false);
    expect(shouldOpenFromEdgeSwipe(state, 5, 200)).toBe(false);
  });

  it('does not open when the gesture is mostly vertical (a scroll starting near the edge)', () => {
    expect(shouldOpenFromEdgeSwipe(state, 70, 400)).toBe(false);
  });
});
