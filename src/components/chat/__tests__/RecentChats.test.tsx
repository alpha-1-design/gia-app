import { describe, expect, it, vi } from 'vitest';
import type { ChatSession, Message } from '../../../store/useGiaStore';
import { getRecentChatItems } from '../recentChatsUtils';
import { fireEvent, render, screen } from '@testing-library/react';
import RecentChats from '../RecentChats';
import { useGiaStore } from '../../../store/useGiaStore';

const makeSession = (id: string, updatedAt: number, title = `Chat ${id}`): ChatSession => ({
  id,
  title,
  createdAt: updatedAt,
  updatedAt,
  currentBranchId: `branch-${id}`,
  messages: [],
});

const makeMessage = (id: string, branchId: string, content: string): Message => ({
  id,
  branchId,
  role: 'user',
  content,
  timestamp: 1,
});

describe('getRecentChatItems', () => {
  it('returns at most two non-empty conversations, newest first, excluding the active chat', () => {
    const sessions = [
      makeSession('old', 100),
      makeSession('active', 500),
      makeSession('newest', 900),
      makeSession('middle', 600),
      makeSession('empty', 1000),
    ];
    const messages: Record<string, Message[]> = {
      old: [makeMessage('old-msg', 'branch-old', 'Older conversation')],
      active: [makeMessage('active-msg', 'branch-active', 'Currently open')],
      newest: [makeMessage('newest-msg', 'branch-newest', 'Latest conversation')],
      middle: [makeMessage('middle-msg', 'branch-middle', 'Previous conversation')],
      empty: [],
    };

    const items = getRecentChatItems(sessions, 'active', (id) => messages[id] ?? []);

    expect(items.map(({ session }) => session.id)).toEqual(['newest', 'middle']);
  });

  it('uses the latest non-empty message as a single-line preview', () => {
    const session = makeSession('one', 100);
    const messages = [
      makeMessage('first', session.currentBranchId, 'First message'),
      makeMessage('last', session.currentBranchId, 'Continue\nwith this plan'),
    ];

    expect(getRecentChatItems([session], null, () => messages)[0]?.preview).toBe('Continue with this plan');
  });

  it('ignores empty draft sessions and conversations without content', () => {
    const draft = makeSession('draft', 200, 'New Chat');
    const noContent = makeSession('no-content', 300);

    expect(getRecentChatItems([draft, noContent], null, () => [])).toEqual([]);
  });

  it('reopens a saved conversation when its resume card is selected', () => {
    const session = makeSession('resume-me', 300, 'Biology revision');
    session.messages = [{
      message: makeMessage('message-1', session.currentBranchId, 'Continue cell structure revision'),
      children: [],
    }];
    const originalState = useGiaStore.getState();
    useGiaStore.setState({ sessions: [session] });
    const onResume = vi.fn();

    render(<RecentChats sessions={[session]} activeSessionId={null} onResume={onResume} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume conversation: Biology revision' }));

    expect(onResume).toHaveBeenCalledWith('resume-me');
    useGiaStore.setState({ sessions: originalState.sessions });
  });
});
