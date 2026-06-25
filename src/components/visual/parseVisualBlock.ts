import { repairJson } from '../../utils/jsonRepair';

export interface VisualBlock {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Parse a visual block from a JSON string.
 * Uses jsonRepair as a fallback before giving up, so minor AI formatting
 * mistakes (trailing commas, unquoted keys, markdown fences) don't kill rendering.
 */
export function parseVisualBlock(code: string): VisualBlock | { error: string } {
  if (!code || typeof code !== 'string') {
    return { error: 'Empty visual block.' };
  }

  const raw = code.trim();

  // Pass 1: strict parse
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { error: 'Visual block must be a JSON object.' };
    if (!parsed.type) return { error: 'Visual block must have a "type" field.' };
    if (!parsed.data) return { error: 'Visual block must have a "data" field.' };
    return parsed as VisualBlock;
  } catch {
    // fall through to repair
  }

  // Pass 2: attempt repair (handles trailing commas, unquoted keys, markdown fences, etc.)
  try {
    const repaired = repairJson(raw);
    if (!repaired) return { error: 'Could not parse visual block JSON.' };
    const parsed = JSON.parse(repaired);
    if (!parsed || typeof parsed !== 'object') return { error: 'Visual block must be a JSON object.' };
    if (!parsed.type) return { error: 'Visual block must have a "type" field.' };
    if (!parsed.data) return { error: 'Visual block must have a "data" field.' };
    return parsed as VisualBlock;
  } catch {
    // fall through to last-resort extraction
  }

  // Pass 3: last resort — try to extract a JSON object anywhere in the string
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const slice = raw.slice(start, end + 1);
      const repaired = repairJson(slice);
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object' && parsed.type && parsed.data) {
        return parsed as VisualBlock;
      }
    }
  } catch {
    // nothing worked
  }

  return { error: 'Invalid JSON in visual block. The AI may have produced malformed output.' };
}
