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

export function extractToolCalls(text: string): ToolCall[] {
  // Match standard ```tool blocks
  const toolBlocks = Array.from(text.matchAll(/```tool\s*\n?([\s\S]*?)```/g));
  // Also match ```json blocks that may contain tool call JSON
  const jsonBlocks = Array.from(text.matchAll(/```json\s*\n?([\s\S]*?)```/g));
  const calls: ToolCall[] = [];
  for (const m of [...toolBlocks, ...jsonBlocks]) {
    const parsed = parseJsonSafely<ToolCall>(m[1]);
    if (parsed && parsed.id && typeof parsed.args === 'object') {
      calls.push(parsed);
    }
  }
  return calls;
}
