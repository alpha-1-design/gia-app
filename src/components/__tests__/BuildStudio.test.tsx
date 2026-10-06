import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BuildStudio } from '../BuildStudio';
import { angleForIndex, shortestDelta } from '../StyleCarousel';
import { BUILD_STARTERS, BUILD_STYLES, composeBuildPrompt, findBuildStyle } from '../../config/buildStyles';
import { useGiaStore } from '../../store/useGiaStore';

describe('build styles data', () => {
  it('has unique ids and a usable rgb triple for every style', () => {
    expect(new Set(BUILD_STYLES.map(s => s.id)).size).toBe(BUILD_STYLES.length);
    for (const s of BUILD_STYLES) expect(s.rgb).toMatch(/^\d{1,3}, \d{1,3}, \d{1,3}$/);
  });
  it('has unique starter ids and non-trivial prompts', () => {
    expect(new Set(BUILD_STARTERS.map(s => s.id)).size).toBe(BUILD_STARTERS.length);
    for (const s of BUILD_STARTERS) expect(s.prompt.length).toBeGreaterThan(60);
  });
  it('composes the prompt with the style on its own line', () => {
    const style = findBuildStyle('terminal')!;
    const out = composeBuildPrompt('Build a thing.', style);
    expect(out.startsWith('Build a thing.\n\nStyle: Terminal.')).toBe(true);
    expect(composeBuildPrompt('Build a thing.', undefined)).toBe('Build a thing.');
  });
});

describe('carousel maths', () => {
  it('brings card i to the front', () => {
    expect(angleForIndex(0, 10)).toBeCloseTo(0);
    expect(angleForIndex(5, 10)).toBe(-180);
  });
  it('takes the short way round', () => {
    expect(shortestDelta(0, -350)).toBeCloseTo(10);
    expect(shortestDelta(350, 10)).toBeCloseTo(20);
    expect(shortestDelta(0, 90)).toBeCloseTo(90);
  });
});

describe('BuildStudio', () => {
  beforeEach(() => {
    useGiaStore.setState({ buildStyleId: 'neon-glass', reduceMotion: true });
    useGiaStore.getState().setPendingInput('');
  });
  afterEach(cleanup);

  it('renders nothing when closed', () => {
    const { container } = render(<BuildStudio isOpen={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lets you change the style and shows its direction', () => {
    render(<BuildStudio isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('option', { name: /Terminal/ }));
    expect(useGiaStore.getState().buildStyleId).toBe('terminal');
    expect(screen.getByText(/Monospace type/)).toBeInTheDocument();
  });

  it('fills the composer with the starter plus the chosen style and does not send it', () => {
    const onClose = vi.fn();
    const onPick = vi.fn();
    useGiaStore.setState({ buildStyleId: 'brutalist' });
    render(<BuildStudio isOpen onClose={onClose} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Habit tracker/ }));
    const pending = useGiaStore.getState().pendingInput as unknown;
    const text = typeof pending === 'string' ? pending : (pending as { text?: string } | null)?.text ?? '';
    expect(text).toContain('Build a habit tracker');
    expect(text).toContain('Style: Brutalist.');
    expect(onPick).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
