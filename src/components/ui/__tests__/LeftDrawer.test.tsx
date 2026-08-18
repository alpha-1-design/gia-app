import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftDrawer } from '../LeftDrawer';

describe('LeftDrawer', () => {
  it('renders children and closes on backdrop click', () => {
    let closed = false;
    const { container } = render(
      <LeftDrawer open={true} onClose={() => { closed = true; }}>
        <div>drawer content</div>
      </LeftDrawer>
    );

    screen.getByText('drawer content');

    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(closed).toBe(true);
  });

  it('renders nothing when closed', () => {
    const { queryByText } = render(
      <LeftDrawer open={false} onClose={() => {}}>
        <div>drawer content</div>
      </LeftDrawer>
    );
    expect(queryByText('drawer content')).toBeNull();
  });
});
