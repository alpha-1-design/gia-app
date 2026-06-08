export interface StreamParserState {
  accumulated: string;
  thoughtsAccumulated: string;
  inThinkBlock: boolean;
  inToolBlock: boolean;
  pendingBacktickCount: number;
}

export const createStreamParser = (): StreamParserState => ({
  accumulated: '',
  thoughtsAccumulated: '',
  inThinkBlock: false,
  inToolBlock: false,
  pendingBacktickCount: 0,
});

export const processStreamChunk = (
  chunk: string,
  state: StreamParserState,
): string => {
  if (state.pendingBacktickCount > 0) {
    const needed = 3 - state.pendingBacktickCount;
    const chunkAfter = chunk.startsWith('`') ? chunk.slice(needed) : chunk;
    if (chunk.startsWith('tool') && needed <= 3) {
      chunk = '`'.repeat(state.pendingBacktickCount) + chunk;
    } else if (chunkAfter.startsWith('tool') && needed <= 3) {
      chunk = chunk.slice(needed);
    }
    state.pendingBacktickCount = 0;
  }

  let remaining = chunk;
  let displayChunk = '';

  while (remaining.length > 0) {
    if (state.inThinkBlock) {
      const endIdx = remaining.indexOf('</think>');
      if (endIdx >= 0) {
        state.thoughtsAccumulated += remaining.slice(0, endIdx);
        remaining = remaining.slice(endIdx + 8);
        state.inThinkBlock = false;
      } else {
        state.thoughtsAccumulated += remaining;
        remaining = '';
      }
    } else if (state.inToolBlock) {
      const endIdx = remaining.indexOf('\n```');
      if (endIdx >= 0) {
        remaining = remaining.slice(endIdx + 4);
        state.inToolBlock = false;
      } else if (remaining.startsWith('```')) {
        remaining = remaining.slice(3);
        state.inToolBlock = false;
      } else {
        remaining = '';
      }
    } else {
      const thinkStart = remaining.indexOf('<think>');
      let toolStart = remaining.indexOf('```tool');
      if (toolStart > 0 && remaining[toolStart - 1] !== '\n') toolStart = -1;
      if (toolStart === 0) toolStart = 0; // Allow at chunk start (boundary case)

      if (toolStart >= 0 && (thinkStart === -1 || toolStart < thinkStart)) {
        const before = remaining.slice(0, toolStart);
        displayChunk += before;
        const afterFence = remaining.slice(toolStart + 7);
        const closeIdx = afterFence.indexOf('\n```');
        if (closeIdx >= 0) {
          remaining = afterFence.slice(closeIdx + 4);
        } else if (afterFence.startsWith('```')) {
          remaining = afterFence.slice(3);
        } else {
          state.inToolBlock = true;
          remaining = '';
        }
      } else if (thinkStart >= 0) {
        const before = remaining.slice(0, thinkStart);
        displayChunk += before;
        remaining = remaining.slice(thinkStart + 7);
        state.inThinkBlock = true;
      } else {
        displayChunk += remaining;
        remaining = '';
      }
    }
  }

  const trailingBackticks = displayChunk.match(/`{1,3}$/);
  if (trailingBackticks) {
    state.pendingBacktickCount = trailingBackticks[0].length;
    displayChunk = displayChunk.slice(0, -state.pendingBacktickCount);
  }

  state.accumulated += displayChunk;
  return displayChunk;
};

export const stripToolBlocks = (text: string): string => {
  let result = text.replace(/```tool[\s\S]*?```/g, '');
  result = result.replace(/```tool[\s\S]*$/gm, '');
  result = result.replace(/```[\s\S]*?"(?:tool|function|name)"[\s\S]*?```/g, '');
  result = result.replace(/^\s*\{(?:[^{}]|"(?:[^"\\]|\\.)*")*"(?:tool|function|name)"\s*:[\s\S]*?\}\s*$/gm, '');
  result = result.replace(/(?:^|\n)\s*```[\s\S]*?(?:$|\n```)/g, '');
  return result.trim();
};

export const processStreamForDisplay = (accumulated: string): string => {
  return stripToolBlocks(accumulated) || '…';
};

export const flushThinkBlock = (state: StreamParserState): string => {
  if (state.inThinkBlock && state.thoughtsAccumulated) {
    state.accumulated += '<think>' + state.thoughtsAccumulated;
    state.thoughtsAccumulated = '';
    state.inThinkBlock = false;
  }
  return state.accumulated;
};
