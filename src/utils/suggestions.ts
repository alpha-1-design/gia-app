/**
 * Follow-up suggestions come from the model itself, in a fenced block:
 *
 *   ```suggestions
 *   What changed in the last release?
 *   Show me a minimal example.
 *   ```
 *
 * They are parsed out of the answer before it is stored so the raw block never
 * reaches the transcript, and attached to the message as `suggestions`.
 */

const BLOCK = /```suggestions[^\n]*\n([\s\S]*?)```/i;

export function extractSuggestions(text: string): { content: string; suggestions: string[] } {
  const match = text.match(BLOCK);
  if (!match) return { content: text, suggestions: [] };

  const suggestions = match[1]
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);

  const content = text
    .replace(BLOCK, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { content, suggestions };
}

/**
 * Streaming-safe version: hides a complete block and also the opening fence of
 * a block that is still being written, so the user never sees raw JSON-ish
 * scaffolding flash in the transcript.
 */
export function stripSuggestionScaffolding(text: string): string {
  const complete = text.replace(/```suggestions[\s\S]*?```/gi, '');
  return complete.replace(/```suggestions[\s\S]*$/i, '').replace(/\n{3,}/g, '\n\n');
}
