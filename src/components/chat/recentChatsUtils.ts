import type { ChatSession, Message } from '../../store/useGiaStore';

export interface RecentChatItem {
  session: ChatSession;
  preview: string;
}

export function getRecentChatItems(
  sessions: ChatSession[],
  activeSessionId: string | null,
  getBranchMessages: (sessionId: string, branchId: string) => Message[],
): RecentChatItem[] {
  return sessions
    .filter((session) => session.id !== activeSessionId && session.title !== 'New Chat')
    .map((session) => {
      const messages = getBranchMessages(session.id, session.currentBranchId);
      const lastMessage = [...messages].reverse().find(
        (message) => (message.role === 'user' || message.role === 'assistant') && message.content.trim(),
      );
      return lastMessage ? { session, preview: lastMessage.content.replace(/\s+/g, ' ').trim() } : null;
    })
    .filter((item): item is RecentChatItem => item !== null)
    .sort((a, b) => b.session.updatedAt - a.session.updatedAt)
    .slice(0, 2);
}
