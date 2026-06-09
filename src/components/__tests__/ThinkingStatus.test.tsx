import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThinkingStatus, ThinkingOverlay } from '../ThinkingStatus';

describe('ThinkingStatus', () => {
  it('renders with a known tool name', () => {
    const { container } = render(<ThinkingStatus toolName="web_search" />);
    expect(container.textContent).toContain('Searching the web');
  });

  it('renders a generic phase when no tool name', () => {
    const { container } = render(<ThinkingStatus phase="coding" />);
    expect(container.textContent).toContain('Coding');
  });

  it('renders without crashing when no props', () => {
    const { container } = render(<ThinkingStatus />);
    expect(container.textContent).toContain('Gathering context');
  });
});

describe('ThinkingOverlay', () => {
  it('renders with a known tool name', () => {
    const { container } = render(<ThinkingOverlay toolName="terminal_run" />);
    expect(container.textContent).toContain('Running code');
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders stop button when onStop provided', () => {
    const { container } = render(<ThinkingOverlay toolName="web_search" onStop={() => {}} />);
    expect(container.querySelector('[title="Stop"]')).toBeDefined();
  });

  it('renders with a specific phase', () => {
    const { container } = render(<ThinkingOverlay phase="analyzing" />);
    expect(container.textContent).toContain('Analyzing');
  });

  it('does not crash with empty props', () => {
    const { container } = render(<ThinkingOverlay />);
    expect(container.textContent).toContain('Gathering context');
  });
});
