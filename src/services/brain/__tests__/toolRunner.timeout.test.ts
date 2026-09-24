import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeToolBlocks, type ExecutionState } from '../toolRunner';
import { useProtocolStore } from '../../../store/useProtocolStore';
import GiaTools from '../../ToolRegistry';
import type { Tool } from '../../tools/types';

function toolBlock(id: string, args: Record<string, unknown> = {}) {
  return `\`\`\`tool\n${JSON.stringify({ id, args })}\n\`\`\``;
}

const HANGING_TOOL: Tool = {
  id: 'hanging_test_tool',
  name: 'hanging_test_tool',
  description: 'Never resolves. Used to prove the tool timeout fires.',
  execute: () => new Promise<never>(() => { /* never settles */ }),
};

describe('executeToolBlocks — tool execution timeout', () => {
  beforeEach(() => {
    useProtocolStore.setState({ consoleProtocols: [], fullAutonomy: true });
  });

  afterEach(() => {
    GiaTools.unregister(HANGING_TOOL.id);
    vi.useRealTimers();
  });

  it('abandons a tool that never resolves and reports it as a failure', async () => {
    vi.useFakeTimers();
    GiaTools.register(HANGING_TOOL);

    // Without the timeout this promise never settles and the whole brain loop
    // wedges, leaving the UI stuck in a thinking state until the user
    // navigates away and back.
    const state: ExecutionState = { history: [], currentPrompt: '', clarificationAttempts: 0 };
    const pending = executeToolBlocks(
      toolBlock(HANGING_TOOL.id),
      state,
      undefined,
      undefined,
      undefined,
      'message-timeout',
    );

    // Push past the 120s tool budget plus a little slack.
    await vi.advanceTimersByTimeAsync(121_000);

    await pending;

    // The failure has to reach the model as an observation, otherwise the loop
    // still has nothing to continue from.
    const fed = state.history.map(m => m.content).join('\n');
    expect(fed).toMatch(/TOOL FAILED/);
    expect(fed).toMatch(/did not respond within 120s/);
  }, 20_000);
});
