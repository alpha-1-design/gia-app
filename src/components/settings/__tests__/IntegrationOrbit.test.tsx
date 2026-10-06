import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { IntegrationOrbit } from '../IntegrationOrbit';
import { ORBIT_ITEMS } from '../orbitItems';
import { orbitPoints } from '../../../utils/orbitLayout';

afterEach(cleanup);

describe('orbitPoints', () => {
  it('starts at 12 o clock and keeps every point on the circle', () => {
    const pts = orbitPoints(4, 200, 80);
    expect(pts[0].x).toBeCloseTo(100);
    expect(pts[0].y).toBeCloseTo(20);
    expect(pts[1].x).toBeCloseTo(180);
    for (const p of pts) expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(80);
  });
});

describe('IntegrationOrbit', () => {
  it('shows one button per connection and opens its section', () => {
    const onOpen = vi.fn();
    render(<IntegrationOrbit onOpen={onOpen} />);
    expect(screen.getAllByRole('button')).toHaveLength(ORBIT_ITEMS.length);
    fireEvent.click(screen.getByRole('button', { name: /Open Browser/ }));
    expect(onOpen).toHaveBeenCalledWith('conn-browser');
  });
  it('every target is unique per page section it points at', () => {
    for (const it of ORBIT_ITEMS) expect(it.target).toMatch(/^conn-/);
  });
});
