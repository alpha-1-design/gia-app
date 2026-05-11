export function extractJSON(text: string): any {
  const cleaned = text.replace(/```json|```/g, '').trim();
  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) { end = i + 1; break; }
    } else if (ch === '"') {
      i++;
      while (i < cleaned.length && !(cleaned[i] === '"' && cleaned[i-1] !== '\\')) i++;
    }
  }
  if (start === -1 || end === -1) throw new Error('No valid JSON object found');
  return JSON.parse(cleaned.slice(start, end));
}
