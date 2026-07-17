import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThinkingStatus } from '../ThinkingStatus';

describe('ThinkingStatus', () => {
  it('renders with a known tool name', () => {
    const { container } = render(<ThinkingStatus toolName="web_search" />);
    expect(container.textContent).toContain('Searching the web');
  });

  it('renders a generic phase when no tool name', () => {
    const { container } = render(<ThinkingStatus phase="coding" />);
    expect(container.textContent).toContain('Cooking');
  });

  it('renders without crashing when no props', () => {
    const { container } = render(<ThinkingStatus />);
    expect(container.textContent).toBeDefined();
  });
});
