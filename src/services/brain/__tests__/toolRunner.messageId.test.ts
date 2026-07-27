import { describe, it, expect, beforeEach } from 'vitest';
import { executeToolBlocks } from '../toolRunner';
import { useProtocolStore } from '../../../store/useProtocolStore';

function toolBlock(id: string, args: Record<string, unknown> = {}) {
  return `\`\`\`tool\n${JSON.stringify({ id, args })}\n\`\`\``;
}

// list_goals always resolves { success: true } synchronously with no native
// platform dependency, so it doesn't hit the retry/backoff path and keeps
// these tests fast and deterministic.
const TEST_TOOL = 'list_goals';

describe('executeToolBlocks — messageId attribution', () => {
  beforeEach(() => {
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
    // This reproduces the reported bug: "Proposed" tool cards would
    // sometimes never appear because messageId used to be tracked via a
    // single shared module-level variable. If a second generation started
    // (or reset it) while a first one's tool call was still in flight, the
    // first call's protocol got tagged with the wrong id (or none), so it
    // never matched any rendered message and silently never showed up.
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
    // Nothing should have landed with no owner or the wrong owner.
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
