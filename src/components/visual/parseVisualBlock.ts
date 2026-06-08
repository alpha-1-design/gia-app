export interface VisualBlock {
  type: string;
  data: Record<string, unknown>;
}

export function parseVisualBlock(code: string): VisualBlock | { error: string } {
  try {
    const parsed = JSON.parse(code);
    if (!parsed.type || !parsed.data) return { error: 'Visual block must have "type" and "data" fields.' };
    return parsed;
  } catch {
    return { error: 'Invalid JSON in visual block.' };
  }
}
