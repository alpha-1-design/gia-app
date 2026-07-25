import { describe, it, expect, beforeEach } from 'vitest';
import { executeToolBlocks } from '../toolRunner';
import { useProtocolStore } from '../../../store/useProtocolStore';
import { registerAllTools } from '../../tools/index';

function toolBlock(id: string, args: Record<string, unknown> = {}) {
  return `\`\`\`tool\n${JSON.stringify({ id, args })}\n\`\`\``;
}

const TEST_TOOL = 'list_goals';

describe('executeToolBlocks — messageId attribution', () => {
  beforeEach(() => {
    registerAllTools();
    useProtocolStore.setState({ consoleProtocols: [], fullAutonomy: true });
  });

  it('tags the created protocol proposal with the messageId passed in for this call', async () => {
    await executeToolBlocks(
      toolBlock(TEST_TOOL),
      { history: [], currentPrompt: '', clarificationAttempts: 0 },
      undefined,
      undefined,
      undefined,
      'message-A',
    );

    const protocols = useProtocolStore.getState().consoleProtocols;
    expect(protocols.length).toBeGreaterThan(0);
    expect(protocols.every(p => p.messageId === 'message-A')).toBe(true);
  });

  it('does not let two concurrent generations cross-contaminate each other\'s messageId', async () => {
    await Promise.all([
      executeToolBlocks(
        toolBlock(TEST_TOOL),
        { history: [], currentPrompt: '', clarificationAttempts: 0 },
        undefined, undefined, undefined,
        'message-A',
      ),
      executeToolBlocks(
        toolBlock(TEST_TOOL),
        { history: [], currentPrompt: '', clarificationAttempts: 0 },
        undefined, undefined, undefined,
        'message-B',
      ),
    ]);

    const protocols = useProtocolStore.getState().consoleProtocols;
    const forA = protocols.filter(p => p.messageId === 'message-A');
    const forB = protocols.filter(p => p.messageId === 'message-B');
    expect(forA.length).toBeGreaterThan(0);
    expect(forB.length).toBeGreaterThan(0);
    expect(protocols.every(p => p.messageId === 'message-A' || p.messageId === 'message-B')).toBe(true);
  });

  it('leaves messageId undefined when none is provided (no ambient fallback)', async () => {
    await executeToolBlocks(
      toolBlock(TEST_TOOL),
      { history: [], currentPrompt: '', clarificationAttempts: 0 },
    );
    const protocols = useProtocolStore.getState().consoleProtocols;
    expect(protocols.length).toBeGreaterThan(0);
    expect(protocols.every(p => p.messageId === undefined)).toBe(true);
  });
});