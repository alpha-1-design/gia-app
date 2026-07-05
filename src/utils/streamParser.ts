import { findFenceClose } from './jsonRepair';

export interface StreamParserState {
  accumulated: string;
  thoughtsAccumulated: string;
  inThinkBlock: boolean;
  inToolBlock: boolean;
  inJsonBlock: boolean;
  jsonBlockBuffer: string;
  pendingBacktickCount: number;
  /** Buffered content inside the current tool block (for recovery on stream end) */
  toolBlockBuffer: string;
}

export const createStreamParser = (): StreamParserState => ({
  accumulated: '',
  thoughtsAccumulated: '',
  inThinkBlock: false,
  inToolBlock: false,
  inJsonBlock: false,
  jsonBlockBuffer: '',
  pendingBacktickCount: 0,
  toolBlockBuffer: '',
});

/** Check if the given string (body of a json block) looks like a tool call JSON.
 *  Uses a stricter heuristic to reduce false positives: requires both `id`/`name` and `args`/`input`
 *  keys, and the `args` value must be an object (starts with `{`) not a primitive. */
function isToolCallJson(body: string): boolean {
  const hasKey = (pattern: RegExp) => pattern.test(body);
  const hasId = hasKey(/"(?:id|tool|function|name)"\s*:/);
  const hasArgs = hasKey(/"(?:args|input)"\s*:/);
  if (!hasId || !hasArgs) return false;
  // Extra guard: the value of `args` should look like an object or array, not a string
  const argsMatch = body.match(/"args"\s*:\s*([{[])/);
  const inputMatch = body.match(/"input"\s*:\s*([{[])/);
  if (argsMatch || inputMatch) return true;
  // If we can't find args with an object value, check `input`
  return false;
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
      // Use findFenceClose to find the actual closing ``` (skips 4+ backticks)
      const endIdx = findFenceClose(remaining, 0);
      if (endIdx >= 0) {
        state.toolBlockBuffer += remaining.slice(0, endIdx);
        remaining = remaining.slice(endIdx + 3);
        state.toolBlockBuffer = '';
        state.inToolBlock = false;
      } else if (remaining.startsWith('```')) {
        state.toolBlockBuffer = '';
        remaining = remaining.slice(3);
        state.inToolBlock = false;
      } else {
        state.toolBlockBuffer += remaining;
        remaining = '';
      }
    } else if (state.inJsonBlock) {
      // We're inside a ```json block — buffer content, look for closing fence
      const endIdx = findFenceClose(remaining, 0);
      if (endIdx >= 0) {
        let content = remaining.slice(0, endIdx);
        if (content.endsWith('\n')) content = content.slice(0, -1);
        state.jsonBlockBuffer += content;
        // Block complete — check if it's a tool call
        if (!isToolCallJson(state.jsonBlockBuffer)) {
          // Not a tool call — release the buffered content to display
          displayChunk += '```json' + state.jsonBlockBuffer + '\n```';
        }
        state.inJsonBlock = false;
        state.jsonBlockBuffer = '';
        remaining = remaining.slice(endIdx + 3);
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
        const closeIdx = findFenceClose(afterFence, 0);
        if (closeIdx >= 0) {
          state.toolBlockBuffer = afterFence.slice(0, closeIdx);
          remaining = afterFence.slice(closeIdx + 3);
          state.toolBlockBuffer = '';
        } else if (afterFence.startsWith('```')) {
          remaining = afterFence.slice(3);
        } else {
          state.inToolBlock = true;
          state.toolBlockBuffer = afterFence;
          remaining = '';
        }
      } else       if (firstMarker && firstMarker.type === 'json') {
        const before = remaining.slice(0, firstMarker.idx);
        displayChunk += before;
        const afterFence = remaining.slice(firstMarker.idx + 7); // skip ```json
        const closeIdx = findFenceClose(afterFence, 0);
        if (closeIdx >= 0) {
          // Complete block in this chunk — strip trailing newline before fence
          let body = afterFence.slice(0, closeIdx);
          if (body.endsWith('\n')) body = body.slice(0, -1);
          if (!isToolCallJson(body)) {
            // Not a tool call — show it
            displayChunk += '```json' + body + '\n```';
          }
          remaining = afterFence.slice(closeIdx + 3);
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
  let result = text;

  // Remove ```tool blocks using character-by-character iteration to handle nested backticks
  let stripped = '';
  let pos = 0;
  while (pos < result.length) {
    const toolIdx = result.indexOf('```tool', pos);
    if (toolIdx < 0) { stripped += result.slice(pos); break; }
    stripped += result.slice(pos, toolIdx);
    const closeIdx = findFenceClose(result, toolIdx + 7);
    if (closeIdx < 0) { pos = toolIdx + 7; continue; }
    pos = closeIdx + 3;
    // Include trailing newline as separator if present
    if (pos < result.length && result[pos] === '\n') { stripped += '\n'; pos++; }
  }
  result = stripped;

  // Remove ```json blocks containing tool call indicators using balanced iteration
  stripped = '';
  pos = 0;
  while (pos < result.length) {
    const jsonIdx = result.indexOf('```json', pos);
    if (jsonIdx < 0) { stripped += result.slice(pos); break; }
    const before = result.slice(pos, jsonIdx);
    const closeIdx = findFenceClose(result, jsonIdx + 7);
    if (closeIdx < 0) {
      stripped += before + '```json';
      pos = jsonIdx + 7;
      continue;
    }
    let body = result.slice(jsonIdx + 7, closeIdx);
    if (body.endsWith('\n')) body = body.slice(0, -1);
    if (!isToolCallJson(body)) {
      // Not a tool call — keep it
      stripped += before + '```json' + body + '\n```';
    } else {
      // Tool call — skip, keep surrounding newlines
      stripped += before;
    }
    pos = closeIdx + 3;
    // Include trailing newline as separator if present
    if (pos < result.length && result[pos] === '\n') { stripped += '\n'; pos++; }
  }
  result = stripped;

  // Remove bare JSON objects with tool call indicators (not inside fences)
  // Use a line-by-line approach to handle nested objects
  const lines = result.split('\n');
  const filtered: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && isToolCallJson(trimmed)) {
      try { JSON.parse(trimmed); filtered.push(''); continue; } catch { /* not parseable, keep */ }
    }
    filtered.push(line);
  }
  result = filtered.join('\n');

  return result.trim();
};

export const processStreamForDisplay = (accumulated: string): string => {
  const stripped = stripToolBlocks(accumulated);
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

export const flushToolBlock = (state: StreamParserState): string => {
  if (state.inToolBlock && state.toolBlockBuffer) {
    state.accumulated += '```tool\n' + state.toolBlockBuffer + '\n```';
    state.toolBlockBuffer = '';
    state.inToolBlock = false;
  }
  return state.accumulated;
};
