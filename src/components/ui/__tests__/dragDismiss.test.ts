import { describe, it, expect } from 'vitest';
import { shouldDismissFromDrag, shouldDismissFromLeftDrag } from '../dragDismiss';

describe('shouldDismissFromDrag (BottomSheet, y-axis)', () => {
  it('dismisses past the distance threshold or on a fast flick', () => {
    expect(shouldDismissFromDrag({ offset: { x: 0, y: 121 }, velocity: { x: 0, y: 0 } })).toBe(true);
    expect(shouldDismissFromDrag({ offset: { x: 0, y: 20 }, velocity: { x: 0, y: 501 } })).toBe(true);
  });

  it('does not dismiss on a small, slow drag or an upward drag', () => {
    expect(shouldDismissFromDrag({ offset: { x: 0, y: 30 }, velocity: { x: 0, y: 10 } })).toBe(false);
    expect(shouldDismissFromDrag({ offset: { x: 0, y: -200 }, velocity: { x: 0, y: -50 } })).toBe(false);
  });
});

describe('shouldDismissFromLeftDrag (LeftDrawer, x-axis)', () => {
  it('dismisses past the leftward distance threshold or on a fast leftward flick', () => {
    expect(shouldDismissFromLeftDrag({ offset: { x: -101, y: 0 }, velocity: { x: 0, y: 0 } })).toBe(true);
    expect(shouldDismissFromLeftDrag({ offset: { x: -10, y: 0 }, velocity: { x: -501, y: 0 } })).toBe(true);
  });

  it('does not dismiss on a small, slow drag or a rightward drag', () => {
    expect(shouldDismissFromLeftDrag({ offset: { x: -30, y: 0 }, velocity: { x: -10, y: 0 } })).toBe(false);
    expect(shouldDismissFromLeftDrag({ offset: { x: 200, y: 0 }, velocity: { x: 50, y: 0 } })).toBe(false);
  });

  it('does not dismiss right at the boundary', () => {
    expect(shouldDismissFromLeftDrag({ offset: { x: -100, y: 0 }, velocity: { x: -500, y: 0 } })).toBe(false);
  });
});
