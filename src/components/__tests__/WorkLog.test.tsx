import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkLog } from '../WorkLog';

// Bug report: while GIA is web searching, a full step-by-step panel forced
// itself open even though the user never tapped to expand it. Root cause
// was in MessageList.tsx passing isExpanded={showThoughts.has(msg.id) ||
// !!liveThoughts[msg.id]} -- the live-thoughts half of that OR meant any
// live tool run (including web_search) auto-expanded the full detail view.
// WorkLog itself was always correct (it only expands the step timeline
// when isExpanded is true); the bug was purely in what the caller passed.
// These tests pin WorkLog's actual contract: a live run should still show
// a calm status header (so the user knows something is happening) without
// forcing the detailed step list open.
describe('WorkLog during a live run (e.g. web search)', () => {
  const liveWebSearchThoughts = '🧠 web_search → {"query":"test"}\n⚡ Executing: web_search';

  it('shows a compact status header while live, even when not explicitly expanded', () => {
    const { container } = render(
      <WorkLog
        thoughts={liveWebSearchThoughts}
        isLive={true}
        isExpanded={false}
        onToggle={vi.fn()}
        currentTool="web_search"
      />
    );
    expect(screen.getByText('Searching the web')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="worklog-steps"]')).toBeNull();
  });

  it('does render the detailed step timeline once the user explicitly expands it', () => {
    const { container } = render(
      <WorkLog
        thoughts={liveWebSearchThoughts}
        isLive={true}
        isExpanded={true}
        onToggle={vi.fn()}
        currentTool="web_search"
      />
    );
    expect(container.querySelector('[data-testid="worklog-steps"]')).not.toBeNull();
    expect(screen.getAllByText('Searching the web').length).toBeGreaterThan(0);
  });
});
