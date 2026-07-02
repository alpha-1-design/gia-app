export interface StreamParserState {
  accumulated: string;
  thoughtsAccumulated: string;
  inThinkBlock: boolean;
  inToolBlock: boolean;
  inJsonBlock: boolean;
  jsonBlockBuffer: string;
  pendingBacktickCount: number;
}

export const createStreamParser = (): StreamParserState => ({
  accumulated: '',
  thoughtsAccumulated: '',
  inThinkBlock: false,
  inToolBlock: false,
  inJsonBlock: false,
  jsonBlockBuffer: '',
  pendingBacktickCount: 0,
});

/** Check if the given string (body of a json block) looks like a tool call JSON */
function isToolCallJson(body: string): boolean {
  return /"(?:id|tool|function|name)"\s*:/.test(body)
    && /"(?:args|input)"\s*:/.test(body);
}

export const processStreamChunk = (
  chunk: string,
  state: StreamParserState,
): string => {
  if (state.pendingBacktickCount > 0) {
    const needed = 3 - state.pendingBacktickCount;
    const chunkAfter = chunk.startsWith('`') ? chunk.slice(needed) : chunk;
    if ((chunk.startsWith('tool') || chunk.startsWith('json') || chunk.startsWith('visual')) && needed <= 3) {
      chunk = '```' + chunk;
    } else if ((chunkAfter.startsWith('tool') || chunkAfter.startsWith('json') || chunkAfter.startsWith('visual')) && needed <= 3) {
      chunk = '`'.repeat(state.pendingBacktickCount) + chunk;
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
    } else if (state.inJsonBlock) {
      // We're inside a ```json block — buffer content, look for closing fence
      const endIdx = remaining.indexOf('\n```');
      if (endIdx >= 0) {
        state.jsonBlockBuffer += remaining.slice(0, endIdx);
        // Block complete — check if it's a tool call
        if (!isToolCallJson(state.jsonBlockBuffer)) {
          // Not a tool call — release the buffered content to display
          displayChunk += '```json' + state.jsonBlockBuffer + '\n```';
        }
        state.inJsonBlock = false;
        state.jsonBlockBuffer = '';
        remaining = remaining.slice(endIdx + 4);
      } else if (remaining.startsWith('```')) {
        state.inJsonBlock = false;
        state.jsonBlockBuffer = '';
        remaining = remaining.slice(3);
      } else {
        state.jsonBlockBuffer += remaining;
        remaining = '';
      }
    } else {
      const thinkStart = remaining.indexOf('<think>');
      let toolStart = remaining.indexOf('```tool');
      if (toolStart > 0 && remaining[toolStart - 1] !== '\n') toolStart = -1;

      // Also detect ```json blocks that may contain tool calls
      let jsonStart = remaining.indexOf('```json');
      if (jsonStart > 0 && remaining[jsonStart - 1] !== '\n') jsonStart = -1;

      // Pick the earliest marker
      const firstMarker = (() => {
        const candidates: { idx: number; type: string }[] = [];
        if (toolStart >= 0) candidates.push({ idx: toolStart, type: 'tool' });
        if (thinkStart >= 0) candidates.push({ idx: thinkStart, type: 'think' });
        if (jsonStart >= 0) candidates.push({ idx: jsonStart, type: 'json' });
        candidates.sort((a, b) => a.idx - b.idx);
        return candidates.length > 0 ? candidates[0] : null;
      })();

      if (firstMarker && firstMarker.type === 'tool') {
        const before = remaining.slice(0, firstMarker.idx);
        displayChunk += before;
        const afterFence = remaining.slice(firstMarker.idx + 7);
        const closeIdx = afterFence.indexOf('\n```');
        if (closeIdx >= 0) {
          remaining = afterFence.slice(closeIdx + 4);
        } else if (afterFence.startsWith('```')) {
          remaining = afterFence.slice(3);
        } else {
          state.inToolBlock = true;
          remaining = '';
        }
      } else if (firstMarker && firstMarker.type === 'json') {
        const before = remaining.slice(0, firstMarker.idx);
        displayChunk += before;
        const afterFence = remaining.slice(firstMarker.idx + 7); // skip ```json
        const closeIdx = afterFence.indexOf('\n```');
        if (closeIdx >= 0) {
          // Complete block in this chunk
          const body = afterFence.slice(0, closeIdx);
          if (!isToolCallJson(body)) {
            // Not a tool call — show it
            displayChunk += '```json' + body + '\n```';
          }
          remaining = afterFence.slice(closeIdx + 4);
        } else if (afterFence.startsWith('```')) {
          // Empty json block
          remaining = afterFence.slice(3);
        } else {
          // Block continues in next chunk
          state.inJsonBlock = true;
          state.jsonBlockBuffer = afterFence;
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
    const count = trailingBackticks[0].length;
    if (count < 3) {
      state.pendingBacktickCount = count;
      displayChunk = displayChunk.slice(0, -count);
    }
  }

  state.accumulated += displayChunk;
  return displayChunk;
};

export const stripToolBlocks = (text: string): string => {
  // Remove standard ```tool blocks
  let result = text.replace(/```tool[\s\S]*?```/g, '');
  // Remove incomplete trailing ```tool blocks
  result = result.replace(/```tool[\s\S]*$/gm, '');
  // Remove ```json or ``` blocks containing tool call indicators (must have both id and args/input keys)
  result = result.replace(/```(?:json)?\s*\n?[\s\S]*?"(?:id|tool|function|name)"\s*:[\s\S]*?"(?:args|input)"\s*:[\s\S]*?```/g, '');
  // Remove bare JSON objects with tool call indicators (not inside fences)
  result = result.replace(/^\s*\{(?:[^{}]|"(?:[^"\\]|\\.)*")*"(?:id|tool|function|name)"\s*:[\s\S]*?"(?:args|input)"\s*:[\s\S]*?\}\s*$/gm, '');
  return result.trim();
};

export const processStreamForDisplay = (accumulated: string): string => {
  const stripped = stripToolBlocks(accumulated);
  // If stripping leaves nothing but the original had content (tool blocks only),
  // return an empty string — the caller handles this gracefully
  return stripped;
};

export const flushThinkBlock = (state: StreamParserState): string => {
  if (state.inThinkBlock && state.thoughtsAccumulated) {
    state.accumulated += '<think>' + state.thoughtsAccumulated;
    state.thoughtsAccumulated = '';
    state.inThinkBlock = false;
  }
  return state.accumulated;
};
