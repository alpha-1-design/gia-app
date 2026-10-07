import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { StreamingCursor } from '../StreamingCursor';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

describe('StreamingCursor', () => {
  it('shows the phase label beside the orb while streaming', () => {
    render(<StreamingCursor phase="writing" />);
    expect(screen.getByText('Spilling ink')).toBeDefined();
  });

  it('tags the running tool label when a tool is active', () => {
    render(<StreamingCursor phase="processing" currentTool="web_search" />);
    expect(screen.getByText('Searching the web')).toBeDefined();
  });

  it('keeps the caret present even when the label drops out', () => {
    render(<StreamingCursor phase="coding" />);
    act(() => { vi.advanceTimersByTime(1800 * 5); });
    expect(screen.queryByText('▋')).toBeDefined();
  });
});