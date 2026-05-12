export function extractJSON(text: string): any {
  // Try to find a JSON block between ```json and ```
  const mdMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const rawText = mdMatch ? mdMatch[1] : text;

  // Find the first { and last }
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    // If no braces, maybe it's an array?
    const firstBracket = rawText.indexOf('[');
    const lastBracket = rawText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      return JSON.parse(rawText.slice(firstBracket, lastBracket + 1));
    }
    throw new Error('No valid JSON found');
  }

  const jsonCandidate = rawText.slice(firstBrace, lastBrace + 1);
  
  try {
    return JSON.parse(jsonCandidate);
  } catch (e) {
    // Fallback: try manual extraction with depth tracking if simple parse fails
    let depth = 0;
    let start = -1;
    let end = -1;
    for (let i = 0; i < rawText.length; i++) {
      const ch = rawText[i];
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          end = i + 1;
          try {
            return JSON.parse(rawText.slice(start, end));
          } catch {
            // Keep looking if this specific block wasn't valid
          }
        }
      } else if (ch === '"') {
        i++;
        while (i < rawText.length && !(rawText[i] === '"' && rawText[i - 1] !== '\\')) i++;
      }
    }
    throw new Error('Could not parse extracted JSON');
  }
}
