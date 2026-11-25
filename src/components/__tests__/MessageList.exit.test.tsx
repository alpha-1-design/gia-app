import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import MessageList from '../MessageList';

// Rows used to pop out instantly when a message was deleted. The list is now
// wrapped in AnimatePresence (initial={false}) and each row carries an exit
// (fade + slight lift) plus layout, so survivors glide and removed rows
// animate out instead of vanishing mid-scroll.

afterEach(cleanup);

function renderList(messages: unknown[]) {
  const noop = vi.fn();
  return render(
    <MessageList
      messages={messages as never}
      loading={false}
      streamingMsgId={null}
      expandedMsgs={new Set()}
      setExpandedMsgs={noop}
      thinkingPhase={'idle' as never}
      currentTool={null}
      responseTimesRef={{ current: {} }}
      onCopyMessage={noop}
      onEdit={noop}
      onDeleteWithUndo={noop}
      onContinue={noop}
      onFork={noop}
      onRetry={vi.fn().mockResolvedValue(undefined)}
      onEditResend={noop}
      onRewrite={noop}
    />,
  );
}

const twoMessages = [
  { id: 'm1', role: 'user', content: 'hello', timestamp: 1_700_000_000_000 },
  { id: 'm2', role: 'assistant', content: 'hi there', timestamp: 1_700_000_001_000 },
];

describe('MessageList row exit animation', () => {
  it('keeps a removed row mounted for its exit instead of popping it out', async () => {
    const { rerender, getByText, queryByText } = renderList(twoMessages);
    expect(getByText('hello')).toBeTruthy();
    expect(getByText('hi there')).toBeTruthy();

    // Delete the user message.
    rerender(
      <MessageList
        messages={[twoMessages[1]] as never}
        loading={false}
        streamingMsgId={null}
        expandedMsgs={new Set()}
        setExpandedMsgs={vi.fn()}
        thinkingPhase={'idle' as never}
        currentTool={null}
        responseTimesRef={{ current: {} }}
        onCopyMessage={vi.fn()}
        onEdit={vi.fn()}
        onDeleteWithUndo={vi.fn()}
        onContinue={vi.fn()}
        onFork={vi.fn()}
        onRetry={vi.fn().mockResolvedValue(undefined)}
        onEditResend={vi.fn()}
        onRewrite={vi.fn()}
      />,
    );

    // Immediately after the list change the removed row is still in the DOM —
    // AnimatePresence defers the unmount while the exit plays.
    expect(queryByText('hello')).not.toBeNull();

    // Once the exit transition completes the row unmounts for real.
    await waitFor(() => expect(queryByText('hello')).toBeNull(), { timeout: 3000 });
    // The surviving row is untouched.
    expect(queryByText('hi there')).not.toBeNull();
  });

  it('does not replay enter animations for existing rows (initial={false})', () => {
    // Fresh mount must render rows immediately in their final state — no
    // opacity-0 flash on first paint.
    const { getByText } = renderList(twoMessages);
    const row = getByText('hello').closest('.flex-row-reverse') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row!.style.opacity).not.toBe('0');
  });
});
