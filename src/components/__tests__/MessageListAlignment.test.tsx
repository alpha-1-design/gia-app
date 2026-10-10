import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MessageList from '../MessageList';

// Bug report: after sending a message, the user's avatar (pinned to the right
// edge by flex-row-reverse) sat far from the bubble, because the content column
// was flex-1 and the bubble was left-aligned inside it. The user's column must
// right-align its contents so the bubble hugs the avatar.
function renderList(role: 'user' | 'assistant') {
  const noop = vi.fn();
  const messages = [
    { id: 'm1', role, content: 'hello', timestamp: 1_700_000_000_000 },
  ] as never;
  return render(
    <MessageList
      messages={messages}
      loading={false}
      streamingMsgId={null}
      expandedMsgs={new Set()}
      setExpandedMsgs={noop}
      showThoughts={new Set()}
      setShowThoughts={noop}
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

describe('MessageList user bubble alignment', () => {
  it('right-aligns the content column and header for user messages', () => {
    const { container } = renderList('user');
    const row = container.querySelector('.flex-row-reverse');
    expect(row).not.toBeNull();
    const column = row!.querySelector(':scope > .flex-1');
    expect(column).not.toBeNull();
    expect(column!.className).toContain('items-end');
    const header = column!.querySelector(':scope > div.flex.items-center');
    expect(header!.className).toContain('justify-end');
  });

  it('leaves assistant messages left-aligned', () => {
    const { container } = renderList('assistant');
    const column = container.querySelector('.flex-row > .flex-1');
    expect(column).not.toBeNull();
    expect(column!.className).not.toContain('items-end');
  });
});
