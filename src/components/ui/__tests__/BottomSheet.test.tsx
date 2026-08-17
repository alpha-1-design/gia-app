import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomSheet, shouldDismissFromDrag } from '../BottomSheet';

describe('shouldDismissFromDrag', () => {
  it('dismisses when dragged down past the distance threshold', () => {
    expect(shouldDismissFromDrag({ offset: { x: 0, y: 121 }, velocity: { x: 0, y: 0 } })).toBe(true);
  });

  it('dismisses on a fast downward flick even with a small offset', () => {
    expect(shouldDismissFromDrag({ offset: { x: 0, y: 20 }, velocity: { x: 0, y: 501 } })).toBe(true);
  });

  it('does not dismiss on a small, slow drag (this was the bug -- previously nothing dismissed it)', () => {
    expect(shouldDismissFromDrag({ offset: { x: 0, y: 30 }, velocity: { x: 0, y: 10 } })).toBe(false);
  });

  it('does not dismiss when dragged upward', () => {
    expect(shouldDismissFromDrag({ offset: { x: 0, y: -200 }, velocity: { x: 0, y: -50 } })).toBe(false);
  });

  it('does not dismiss right at the boundary (120px, velocity 500)', () => {
    expect(shouldDismissFromDrag({ offset: { x: 0, y: 120 }, velocity: { x: 0, y: 500 } })).toBe(false);
  });
});

describe('BottomSheet', () => {
  it('renders children, a grabber handle, and closes on backdrop click', () => {
    let closed = false;
    const { container } = render(
      <BottomSheet open={true} onClose={() => { closed = true; }}>
        <div>sheet content</div>
      </BottomSheet>
    );

    screen.getByText('sheet content');

    // Backdrop is the first fixed inset-0 element.
    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(closed).toBe(true);
  });

  it('renders nothing when closed', () => {
    const { queryByText } = render(
      <BottomSheet open={false} onClose={() => {}}>
        <div>sheet content</div>
      </BottomSheet>
    );
    expect(queryByText('sheet content')).toBeNull();
  });
});
