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
    render(
      <WorkLog
        thoughts={liveWebSearchThoughts}
        isLive={true}
        isExpanded={false}
        onToggle={vi.fn()}
        currentTool="web_search"
      />
    );
    // The header (phase label) should still be visible -- collapsed doesn't
    // mean invisible, it means "not forced open."
    screen.getByText(/searching|reasoning|sniffing|googling|processing/i);
  });

  it('does NOT render the detailed step timeline while live but not explicitly expanded', () => {
    const { container } = render(
      <WorkLog
        thoughts={liveWebSearchThoughts}
        isLive={true}
        isExpanded={false}
        onToggle={vi.fn()}
        currentTool="web_search"
      />
    );
    // The step timeline lives under an AnimatePresence gated on isExpanded;
    // with isExpanded=false it must not be in the document, regardless of
    // isLive. This is the exact behavior that was broken.
    expect(container.querySelector('[data-testid="worklog-steps"]')).toBeNull();
    expect(screen.queryByText(/^Searching the web$/)).toBeNull();
  });

  it('does render the detailed step timeline once the user explicitly expands it', () => {
    render(
      <WorkLog
        thoughts={liveWebSearchThoughts}
        isLive={true}
        isExpanded={true}
        onToggle={vi.fn()}
        currentTool="web_search"
      />
    );
    // With isExpanded=true (user tapped it open), the step detail should
    // now be visible -- confirms this isn't just permanently hidden.
    expect(screen.getByText('Searching the web')).toBeInTheDocument();
  });
});
