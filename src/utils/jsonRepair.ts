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

export function extractToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let pos = 0;

  while (pos < text.length) {
    // Find next ```tool or ```json opening
    const toolIdx = text.indexOf('```tool', pos);
    const jsonIdx = text.indexOf('```json', pos);
    let fenceIdx = -1;
    let fenceLen = 0;

    if (toolIdx >= 0 && (jsonIdx < 0 || toolIdx < jsonIdx)) {
      fenceIdx = toolIdx;
      fenceLen = 7; // ```tool
    } else if (jsonIdx >= 0) {
      fenceIdx = jsonIdx;
      fenceLen = 7; // ```json
    }

    if (fenceIdx < 0) break;

    const contentStart = fenceIdx + fenceLen;
    // Skip past newline if present
    const bodyStart = text[contentStart] === '\n' ? contentStart + 1 : contentStart;

    const closeIdx = findJsonFenceClose(text, bodyStart);
    if (closeIdx < 0) break;

    const body = text.slice(bodyStart, closeIdx).trim();
    if (body) {
      const parsed = parseJsonSafely<ToolCall>(body);
      if (parsed && parsed.id && typeof parsed.args === 'object') {
        calls.push(parsed);
      }
    }

    pos = closeIdx + 3; // skip past the closing ```
  }

  return calls;
}
