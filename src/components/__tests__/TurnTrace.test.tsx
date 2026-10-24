import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TurnTrace } from '../turn/TurnTrace';
import type { MessageSegment } from '../../store/useGiaStore';

const START = 1_700_000_000_000;

function page(url: string, status: MessageSegment['toolStatus'] = 'done'): MessageSegment {
  return {
    id: `seg-${url}`,
    type: 'tool',
    content: `🧠 read_url → url: ${url}\n✅ call completed successfully`,
    toolName: 'read_url',
    toolStatus: status,
    startedAt: START + 500,
  };
}

beforeEach(() => {
  // The orb draws on canvas; jsdom has no 2d context and the component
  // returns early without one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TurnTrace', () => {
  it('freezes the timer when the turn ends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(START);

    const { rerender } = render(<TurnTrace segments={[]} isLive startedAt={START} phase="searching" />);
    expect(screen.getByRole('button', { name: 'Working' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('button', { name: 'Working 3s' })).toBeInTheDocument();

    rerender(<TurnTrace segments={[page('https://example.com')]} isLive={false} startedAt={START} durationMs={3000} />);
    expect(screen.getByRole('button', { name: 'Worked for 3s' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole('button', { name: 'Worked for 3s' })).toBeInTheDocument();
  });

  it('summarises completed work and reveals details on tap', () => {
    render(
      <TurnTrace
        segments={[page('https://github.com/openai'), page('https://github.com/anthropics')]}
        isLive={false}
        startedAt={START}
        durationMs={84_000}
        plan="I’ll check the docs first."
      />,
    );

    const header = screen.getByRole('button', { name: /Worked for 1m 24s/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('2 pages')).toBeInTheDocument();
    expect(screen.getByText('I’ll check the docs first.')).toBeInTheDocument();
    expect(screen.queryByText('github.com/openai')).not.toBeInTheDocument();

    fireEvent.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('github.com/openai')).toBeInTheDocument();
    expect(screen.getByText('github.com/anthropics')).toBeInTheDocument();
  });

  it('renders no emoji in its own chrome', () => {
    const { container } = render(
      <TurnTrace segments={[page('https://example.com')]} isLive={false} startedAt={START} durationMs={3000} />,
    );
    expect(container.textContent ?? '').not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('keeps reasoning from older messages reachable', () => {
    render(<TurnTrace thoughts="Older reasoning text." isLive={false} startedAt={START} />);

    const header = screen.getByRole('button', { name: 'Thoughts' });
    fireEvent.click(header);

    const thinking = screen.getByRole('button', { name: /Thinking/ });
    fireEvent.click(thinking);
    expect(screen.getByText('Older reasoning text.')).toBeInTheDocument();
  });
});
