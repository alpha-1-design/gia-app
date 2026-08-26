import { findFenceClose, parseToolCallContent } from './jsonRepair';

export interface TaskData {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details?: string;
}

export interface ArtifactData {
  identifier: string;
  type: string;
  title: string;
  content: string;
}

/**
 * A single ordered unit of a message's generation: a stretch of thinking,
 * a tool call (with its lifecycle), or a stretch of visible response text.
 * Segments are appended in the exact order events actually happen, so
 * rendering them in sequence gives the real think -> work -> think -> work
 * flow instead of collapsing everything into one "thoughts" blob shown
 * before the response.
 */
export interface MessageSegment {
  id: string;
  type: 'thinking' | 'tool' | 'text';
  content: string;
  toolName?: string;
  toolStatus?: 'running' | 'done' | 'failed';
  startedAt: number;
}

let segmentCounter = 0;
const nextSegmentId = () => `seg-${Date.now()}-${segmentCounter++}`;

/** Tool lifecycle lines from toolRunner.ts's onThought callback follow a
 * fixed emoji-prefix convention. Parsing that convention here is what lets
 * us recover discrete tool_call segments from what was previously just a
 * flat log line, without changing toolRunner.ts's execution flow at all. */
function classifyThoughtLine(line: string): { kind: 'tool_start' | 'tool_detail' | 'tool_done' | 'tool_failed' | 'plain'; toolName?: string } {
  const startMatch = line.match(/^🧠\s+(.+?)\s+→/);
  if (startMatch) return { kind: 'tool_start', toolName: startMatch[1] };
  if (/^⚡\s+Executing:/.test(line)) return { kind: 'tool_detail' };
  if (/^✅/.test(line)) return { kind: 'tool_done' };
  if (/^⚠️/.test(line)) return { kind: 'tool_failed' };
  if (/^ {2}·/.test(line)) return { kind: 'tool_detail' };
  return { kind: 'plain' };
}

export interface StreamParserState {
  accumulated: string;
  thoughtsAccumulated: string;
  segments: MessageSegment[];
  inThinkBlock: boolean;
  inToolBlock: boolean;
  inXmlToolBlock: boolean;
  xmlTagBuffer: string;
  xmlTagName: string;
  inJsonBlock: boolean;
  inArtifactBlock: boolean;
  jsonBlockBuffer: string;
  pendingBacktickCount: number;
  toolBlockBuffer: string;
  artifactBlockBuffer: string;
  artifactConfigLine: string;
  artifacts: ArtifactData[];
  tasks: TaskData[];
  pendingTaskMarker: string;
}

export const createStreamParser = (): StreamParserState => ({
  accumulated: '',
  thoughtsAccumulated: '',
  segments: [],
  inThinkBlock: false,
  inToolBlock: false,
  inXmlToolBlock: false,
  xmlTagBuffer: '',
  xmlTagName: '',
  inJsonBlock: false,
  inArtifactBlock: false,
  jsonBlockBuffer: '',
  pendingBacktickCount: 0,
  toolBlockBuffer: '',
  artifactBlockBuffer: '',
  artifactConfigLine: '',
  artifacts: [],
  tasks: [],
  pendingTaskMarker: '',
});

/** Check if the given string (body of a json block) looks like a tool call JSON. */
function isToolCallJson(body: string): boolean {
  if (parseToolCallContent(body) !== null) return true;
  const hasKey = (pattern: RegExp) => pattern.test(body);
  const hasId = hasKey(/"(?:id|tool|function|name)"\s*:/);
  const hasArgs = hasKey(/"(?:args|input)"\s*:/);
  if (!hasId || !hasArgs) return false;
  const argsMatch = body.match(/"args"\s*:\s*([{[])/);
  const inputMatch = body.match(/"input"\s*:\s*([{[])/);
  if (argsMatch || inputMatch) return true;
  return false;
}

export const processStreamChunk = (
  chunk: string,
  state: StreamParserState,
): string => {
  if (state.pendingBacktickCount > 0) {
    const needed = 3 - state.pendingBacktickCount;
    const chunkAfter = chunk.startsWith('`') ? chunk.slice(needed) : chunk;
    if ((chunk.startsWith('tool') || chunk.startsWith('json') || chunk.startsWith('visual') || chunk.startsWith('artifact')) && needed <= 3) {
      chunk = '```' + chunk;
    } else if ((chunkAfter.startsWith('tool') || chunkAfter.startsWith('json') || chunkAfter.startsWith('visual') || chunkAfter.startsWith('artifact')) && needed <= 3) {
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
        appendThinking(state, remaining.slice(0, endIdx));
        remaining = remaining.slice(endIdx + 8);
        state.inThinkBlock = false;
      } else {
        appendThinking(state, remaining);
        remaining = '';
      }
    } else if (state.inXmlToolBlock) {
      const closeTag = `</${state.xmlTagName || 'tool_call'}>`;
      const endIdx = remaining.indexOf(closeTag);
      if (endIdx >= 0) {
        remaining = remaining.slice(endIdx + closeTag.length);
        state.inXmlToolBlock = false;
        state.xmlTagName = '';
      } else {
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
      const endIdx = findFenceClose(remaining, 0);
      if (endIdx >= 0) {
        let content = remaining.slice(0, endIdx);
        if (content.endsWith('\n')) content = content.slice(0, -1);
        state.jsonBlockBuffer += content;
        if (!isToolCallJson(state.jsonBlockBuffer)) {
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
    } else if (state.inArtifactBlock) {
      const endIdx = findFenceClose(remaining, 0);
      if (endIdx >= 0) {
        state.artifactBlockBuffer += remaining.slice(0, endIdx);
        remaining = remaining.slice(endIdx + 3);
        // Parse the completed artifact
        const fullBlock = state.artifactBlockBuffer;
        state.artifactBlockBuffer = '';
        state.inArtifactBlock = false;
        const lines = fullBlock.split('\n');
        const configLine = lines.find(l => l.trim().startsWith('{'));
        if (configLine) {
          try {
            const config = JSON.parse(configLine.trim());
            const content = lines.filter(l => l !== configLine).join('\n').trim();
            if (config.identifier && config.type) {
              state.artifacts.push({
                identifier: config.identifier,
                type: config.type,
                title: config.title || config.identifier,
                content,
              });
            }
          } catch { /* ignore parse errors */ }
        }
      } else if (remaining.startsWith('```')) {
        state.artifactBlockBuffer = '';
        state.inArtifactBlock = false;
        remaining = remaining.slice(3);
      } else {
        state.artifactBlockBuffer += remaining;
        remaining = '';
      }
    } else {
      const thinkStart = remaining.indexOf('<think>');
      const toolStart = remaining.indexOf('```tool');
      const jsonStart = remaining.indexOf('```json');
      const artifactStart = remaining.indexOf('```artifact');

      let xmlToolStart = -1;
      let matchedXmlTag = '';
      const xmlTags = ['tool_call', 'tool_code', 'tool-code', 'function_call', 'function-call', 'tool'];
      for (const tag of xmlTags) {
        const idx = remaining.indexOf(`<${tag}`);
        if (idx >= 0 && (xmlToolStart === -1 || idx < xmlToolStart)) {
          xmlToolStart = idx;
          matchedXmlTag = tag;
        }
      }

      const firstMarker = (() => {
        const candidates: { idx: number; type: string; tag?: string }[] = [];
        if (toolStart >= 0) candidates.push({ idx: toolStart, type: 'tool' });
        if (thinkStart >= 0) candidates.push({ idx: thinkStart, type: 'think' });
        if (jsonStart >= 0) candidates.push({ idx: jsonStart, type: 'json' });
        if (artifactStart >= 0) candidates.push({ idx: artifactStart, type: 'artifact' });
        if (xmlToolStart >= 0) candidates.push({ idx: xmlToolStart, type: 'xml_tool', tag: matchedXmlTag });
        candidates.sort((a, b) => a.idx - b.idx);
        return candidates.length > 0 ? candidates[0] : null;
      })();

      if (firstMarker && firstMarker.type === 'xml_tool') {
        const before = remaining.slice(0, firstMarker.idx);
        displayChunk += before;
        const tag = firstMarker.tag!;
        const closeTag = `</${tag}>`;
        const openTagEnd = remaining.indexOf('>', firstMarker.idx);
        if (openTagEnd >= 0) {
          const closeIdx = remaining.indexOf(closeTag, openTagEnd);
          if (closeIdx >= 0) {
            remaining = remaining.slice(closeIdx + closeTag.length);
          } else {
            state.inXmlToolBlock = true;
            state.xmlTagName = tag;
            remaining = '';
          }
        } else {
          state.inXmlToolBlock = true;
          state.xmlTagName = tag;
          remaining = '';
        }
      } else if (firstMarker && firstMarker.type === 'tool') {
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
          state.inJsonBlock = true;
          state.jsonBlockBuffer = afterFence;
          remaining = '';
        }
      } else if (firstMarker && firstMarker.type === 'artifact') {
        const before = remaining.slice(0, firstMarker.idx);
        displayChunk += before;
        const afterFence = remaining.slice(firstMarker.idx + 11);
        const closeIdx = findFenceClose(afterFence, 0);
        if (closeIdx >= 0) {
          const fullBlock = afterFence.slice(0, closeIdx);
          const lines = fullBlock.split('\n');
          const configLine = lines.find(l => l.trim().startsWith('{'));
          if (configLine) {
            try {
              const config = JSON.parse(configLine.trim());
              const content = lines.filter(l => l !== configLine).join('\n').trim();
              if (config.identifier && config.type) {
                state.artifacts.push({
                  identifier: config.identifier,
                  type: config.type,
                  title: config.title || config.identifier,
                  content,
                });
              }
            } catch { /* ignore */ }
          }
          remaining = afterFence.slice(closeIdx + 3);
        } else if (afterFence.startsWith('```')) {
          remaining = afterFence.slice(3);
        } else {
          state.inArtifactBlock = true;
          state.artifactBlockBuffer = afterFence;
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

  // ── Task marker detection ──────────────────────────────────
  if (state.pendingTaskMarker) {
    displayChunk = state.pendingTaskMarker + displayChunk;
    state.pendingTaskMarker = '';
  }

  const taskLineRegex = /^---TASK:\s*(.+)$/gm;
  let taskMatch;
  let lastEnd = 0;
  while ((taskMatch = taskLineRegex.exec(displayChunk)) !== null) {
    const label = taskMatch[1].trim();
    if (label) {
      const before = displayChunk.slice(lastEnd, taskMatch.index);
      const active = state.tasks.find(t => t.status === 'in_progress');
      if (active && before) active.details = (active.details || '') + before;

      state.tasks.forEach(t => { if (t.status === 'in_progress') t.status = 'completed'; });

      state.tasks.push({
        id: `task-${state.tasks.length + 1}`,
        label,
        status: 'in_progress',
      });
    }
    const nl = displayChunk.indexOf('\n', taskMatch.index);
    lastEnd = nl >= 0 ? nl + 1 : displayChunk.length;
  }

  if (lastEnd > 0) {
    const after = displayChunk.slice(lastEnd);
    const active = state.tasks.find(t => t.status === 'in_progress');
    if (active && after) active.details = (active.details || '') + after;

    displayChunk = displayChunk.replace(taskLineRegex, '').trim();
    const partialMatch = displayChunk.match(/(---TASK:\s*)$/);
    if (partialMatch) {
      state.pendingTaskMarker = partialMatch[1];
      displayChunk = displayChunk.slice(0, -partialMatch[1].length).trim();
    }
  }

  state.accumulated += displayChunk;
  appendResponseText(state, displayChunk);
  return displayChunk;
};

export const stripToolBlocks = (text: string): string => {
  let result = text;

  // Remove XML tool blocks (<tool_call>...</tool_call>, etc.)
  const xmlTags = ['tool_call', 'tool_code', 'tool-code', 'function_call', 'function-call', 'tool'];
  for (const tag of xmlTags) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    result = result.replace(regex, '');
  }

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

export const stripArtifactBlocks = (text: string): string => {
  let result = '';
  let pos = 0;
  while (pos < text.length) {
    const artIdx = text.indexOf('```artifact', pos);
    if (artIdx < 0) { result += text.slice(pos); break; }
    result += text.slice(pos, artIdx);
    const closeIdx = findFenceClose(text, artIdx + 11);
    if (closeIdx < 0) { pos = artIdx + 11; continue; }
    pos = closeIdx + 3;
    if (pos < text.length && text[pos] === '\n') { result += '\n'; pos++; }
  }
  return result.trim();
};

export const processStreamForDisplay = (accumulated: string): string => {
  const stripped = stripToolBlocks(accumulated);
  return stripArtifactBlocks(stripped);
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

export const flushArtifactBlock = (state: StreamParserState): void => {
  if (state.inArtifactBlock && state.artifactBlockBuffer) {
    const fullBlock = state.artifactBlockBuffer;
    const lines = fullBlock.split('\n');
    const configLine = lines.find(l => l.trim().startsWith('{'));
    if (configLine) {
      try {
        const config = JSON.parse(configLine.trim());
        const content = lines.filter(l => l !== configLine).join('\n').trim();
        if (config.identifier && config.type) {
          state.artifacts.push({
            identifier: config.identifier,
            type: config.type,
            title: config.title || config.identifier,
            content,
          });
        }
      } catch { /* ignore */ }
    }
    state.artifactBlockBuffer = '';
    state.inArtifactBlock = false;
  }
};

/**
 * Append text streamed inside a <think>...</think> block. Keeps
 * thoughtsAccumulated working exactly as before (nothing else changes
 * behavior), while also extending or opening a 'thinking' segment so the
 * ordered segments array reflects the same content.
 */
export function appendThinking(state: StreamParserState, text: string): void {
  if (!text) return;
  state.thoughtsAccumulated += text;
  const last = state.segments[state.segments.length - 1];
  if (last && last.type === 'thinking') {
    last.content += text;
  } else {
    state.segments.push({ id: nextSegmentId(), type: 'thinking', content: text, startedAt: Date.now() });
  }
}

/**
 * Append a discrete tool-lifecycle line from toolRunner.ts's onThought
 * callback (e.g. "🧠 web_search → query: ...", "⚡ Executing: web_search...",
 * "✅ web_search completed successfully"). Parses the existing emoji-prefix
 * convention to recover tool_call segment boundaries -- toolRunner.ts
 * itself is unchanged, this just stops flattening its already-ordered
 * events into one string.
 */
export function appendThought(state: StreamParserState, thought: string): void {
  state.thoughtsAccumulated += (state.thoughtsAccumulated ? '\n' : '') + thought;

  const { kind, toolName } = classifyThoughtLine(thought);
  const last = state.segments[state.segments.length - 1];

  if (kind === 'tool_start') {
    state.segments.push({
      id: nextSegmentId(),
      type: 'tool',
      content: thought,
      toolName,
      toolStatus: 'running',
      startedAt: Date.now(),
    });
    return;
  }
  if (kind === 'tool_done' || kind === 'tool_failed') {
    if (last && last.type === 'tool' && last.toolStatus === 'running') {
      last.content += '\n' + thought;
      last.toolStatus = kind === 'tool_done' ? 'done' : 'failed';
      return;
    }
    // Result line arrived without a matching start (shouldn't normally
    // happen given toolRunner.ts's call order, but don't drop the line).
    state.segments.push({
      id: nextSegmentId(), type: 'tool', content: thought,
      toolStatus: kind === 'tool_done' ? 'done' : 'failed', startedAt: Date.now(),
    });
    return;
  }
  if (kind === 'tool_detail' && last && last.type === 'tool') {
    last.content += '\n' + thought;
    return;
  }

  // Plain reasoning line (or a detail line with no open tool segment) --
  // treat like <think> text: extend a trailing thinking segment.
  if (last && last.type === 'thinking') {
    last.content += '\n' + thought;
  } else {
    state.segments.push({ id: nextSegmentId(), type: 'thinking', content: thought, startedAt: Date.now() });
  }
}

/**
 * Append visible response text (the actual answer, not thinking or tool
 * activity) to a trailing 'text' segment. Called alongside the existing
 * displayAccumulated += newDisplay pattern -- same content, now also
 * tracked as an ordered segment so it renders in its real position after
 * whatever thinking/tool segments preceded it, instead of always at the
 * bottom.
 */
export function appendResponseText(state: StreamParserState, text: string): void {
  if (!text) return;
  const last = state.segments[state.segments.length - 1];
  if (last && last.type === 'text') {
    last.content += text;
  } else {
    state.segments.push({ id: nextSegmentId(), type: 'text', content: text, startedAt: Date.now() });
  }
}
