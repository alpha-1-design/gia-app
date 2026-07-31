/**
 * Find the next properly-closing triple-backtick fence (` ``` `) starting from
 * `fromIndex`. Skips 4+ consecutive backticks (not valid close). Handles the
 * case where content inside the fence itself contains single backticks.
 * Returns the index of the first backtick, or -1 if not found.
 */
export function findFenceClose(text: string, fromIndex: number): number {
  let i = fromIndex;
  while (i < text.length) {
    if (text[i] === '`' && text[i + 1] === '`' && text[i + 2] === '`') {
      if (text[i + 3] !== '`') return i;
      while (i < text.length && text[i] === '`') i++;
    } else {
      i++;
    }
  }
  return -1;
}

export function repairJson(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();

  // Handle common cases where model wraps JSON in markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Remove any leading/trailing text before first { or [
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  const firstJsonChar = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (firstJsonChar > 0) s = s.slice(firstJsonChar);

  // Find the last valid JSON closing
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let lastValid = -1;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (c === '\\') { escapeNext = true; continue; }
    if (c === '"' && !escapeNext) { inString = !inString; continue; }
    if (inString) continue;

    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) lastValid = i;
    }
  }

  if (lastValid > 0) s = s.slice(0, lastValid + 1);

  // Fix common JSON syntax errors
  s = s
    // Trailing commas in objects/arrays
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    // Unquoted keys (naive but helps with simple cases)
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // Single quotes to double quotes (for string values)
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
    // Newlines in strings
    .replace(/: *"([^"]*)\n([^"]*)"/g, ': "$1\\n$2"')
    // Remove comments
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  return s;
}

export function parseJsonSafely<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      const repaired = repairJson(raw);
      return JSON.parse(repaired) as T;
    } catch {
      return null;
    }
  }
}

export interface ToolCall {
  id: string;
  args: Record<string, unknown>;
}

/**
 * Like {@link findFenceClose}, but JSON-aware: it finds the closing triple-
 * backtick fence that terminates a fenced JSON body while correctly ignoring
 * any ` ``` ` sequences that appear *inside* JSON string values (e.g. a tool
 * argument that embeds a fenced code block, `{"code":"```python\n...\n```"}`).
 *
 * This is critical for tool execution: the naive first-fence scan would stop
 * at the embedded fence, truncate the JSON, fail to parse it, and silently
 * drop the tool call — leaving the model believing it ran.
 */
export function findJsonFenceClose(text: string, fromIndex: number): number {
  let i = fromIndex;
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  while (i < text.length) {
    const c = text[i];
    // Only treat a ` ``` ` as the closing fence once we're outside any JSON
    // structure (depth 0) and outside a string — i.e. after the top-level
    // value has fully closed.
    if (!inString && depth === 0 && c === '`' && text[i + 1] === '`' && text[i + 2] === '`') {
      if (text[i + 3] !== '`') return i;
      while (i < text.length && text[i] === '`') i++; // skip 4+ backticks
      continue;
    }
    if (escapeNext) { escapeNext = false; i++; continue; }
    if (c === '\\') { escapeNext = true; i++; continue; }
    if (c === '"') { inString = !inString; i++; continue; }
    if (inString) { i++; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth = Math.max(0, depth - 1);
    i++;
  }
  return -1;
}

export function parseToolCallContent(body: string): ToolCall | null {
  if (!body || typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (!trimmed) return null;

  // 1. Try JSON parsing
  const jsonParsed = parseJsonSafely<Record<string, unknown>>(trimmed);
  if (jsonParsed && typeof jsonParsed === 'object' && jsonParsed !== null) {
    const id = (jsonParsed.id || jsonParsed.name || jsonParsed.tool || jsonParsed.function) as string | undefined;
    const args = (jsonParsed.args || jsonParsed.input || jsonParsed.parameters || {}) as Record<string, unknown>;
    if (id && typeof id === 'string' && id.trim()) {
      return { id: id.trim(), args: typeof args === 'object' && args !== null ? args : {} };
    }
  }

  // 2. Try XML key-value pairs (<arg_key> and <arg_value>)
  if (trimmed.includes('<arg_key>') || trimmed.includes('<arg_value>')) {
    const firstTagIdx = trimmed.indexOf('<arg_key>');
    const rawHead = firstTagIdx >= 0 ? trimmed.slice(0, firstTagIdx) : trimmed;
    const toolId = rawHead.replace(/<[^>]+>/g, '').trim().split(/\s+/)[0];

    if (toolId && /^[a-zA-Z0-9_-]+$/.test(toolId)) {
      const args: Record<string, unknown> = {};
      const keyRegex = /<arg_key>\s*([\s\S]*?)\s*<\/arg_key>[\s\S]*?<arg_value>\s*([\s\S]*?)\s*<\/arg_value>/gi;
      let match: RegExpExecArray | null;
      while ((match = keyRegex.exec(trimmed)) !== null) {
        const k = match[1].trim();
        let v: unknown = match[2].trim();
        if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v !== '' && !isNaN(Number(v))) v = Number(v);
        args[k] = v;
      }
      return { id: toolId, args };
    }
  }

  // 3. Fallback: bare tool name + line key:value args
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const firstLineText = lines[0].replace(/<[^>]+>/g, '').trim();
    const toolId = firstLineText.split(/\s+/)[0];
    if (toolId && /^[a-zA-Z0-9_-]+$/.test(toolId)) {
      const args: Record<string, unknown> = {};
      let hasArg = false;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          hasArg = true;
          const k = line.slice(0, colonIdx).trim();
          let v: unknown = line.slice(colonIdx + 1).trim();
          if (v === 'true') v = true;
          else if (v === 'false') v = false;
          else if (v !== '' && !isNaN(Number(v))) v = Number(v);
          args[k] = v;
        }
      }
      if (hasArg) {
        return { id: toolId, args };
      }
    }
  }

  return null;
}

export function extractToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let pos = 0;

  const tagNames = ['tool_call', 'tool_code', 'tool-code', 'function_call', 'function-call', 'tool'];

  while (pos < text.length) {
    const toolIdx = text.indexOf('```tool', pos);
    const jsonIdx = text.indexOf('```json', pos);

    let earliestXmlIdx = -1;
    let earliestTag = '';
    for (const tag of tagNames) {
      const idx = text.indexOf(`<${tag}`, pos);
      if (idx >= 0 && (earliestXmlIdx === -1 || idx < earliestXmlIdx)) {
        earliestXmlIdx = idx;
        earliestTag = tag;
      }
    }

    let minIdx = -1;
    let mode: 'fence' | 'xml' = 'fence';
    let fenceLen = 0;

    if (toolIdx >= 0 && (minIdx === -1 || toolIdx < minIdx)) {
      minIdx = toolIdx;
      mode = 'fence';
      fenceLen = 7;
    }
    if (jsonIdx >= 0 && (minIdx === -1 || jsonIdx < minIdx)) {
      minIdx = jsonIdx;
      mode = 'fence';
      fenceLen = 7;
    }
    if (earliestXmlIdx >= 0 && (minIdx === -1 || earliestXmlIdx < minIdx)) {
      minIdx = earliestXmlIdx;
      mode = 'xml';
    }

    if (minIdx === -1) break;

    if (mode === 'fence') {
      const contentStart = minIdx + fenceLen;
      const bodyStart = text[contentStart] === '\n' ? contentStart + 1 : contentStart;
      const closeIdx = findJsonFenceClose(text, bodyStart);
      if (closeIdx < 0) break;
      const body = text.slice(bodyStart, closeIdx).trim();
      if (body) {
        const parsed = parseToolCallContent(body);
        if (parsed) calls.push(parsed);
      }
      pos = closeIdx + 3;
    } else {
      const openTagEnd = text.indexOf('>', minIdx);
      if (openTagEnd < 0) { pos = minIdx + 1; continue; }
      const closeTagStr = `</${earliestTag}>`;
      const closeIdx = text.indexOf(closeTagStr, openTagEnd);
      if (closeIdx < 0) { pos = openTagEnd + 1; continue; }
      const body = text.slice(openTagEnd + 1, closeIdx).trim();
      if (body) {
        const parsed = parseToolCallContent(body);
        if (parsed) calls.push(parsed);
      }
      pos = closeIdx + closeTagStr.length;
    }
  }

  return calls;
}
