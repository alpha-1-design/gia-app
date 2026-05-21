export function extractJSON(text: string): any {
  let cleaned = text
    .replace(/```json|```/g, '')
    .replace(/```tool[\s\S]*?```/g, '')
    .trim();

  // Strategy 1: find first { and last } or first [ and last ]
  const firstArray = cleaned.indexOf('[');
  const lastArray = cleaned.lastIndexOf(']');
  const firstObj = cleaned.indexOf('{');
  const lastObj = cleaned.lastIndexOf('}');

  let start = -1;
  let end = -1;

  if (firstArray !== -1 && lastArray > firstArray) {
    start = firstArray;
    end = lastArray + 1;
  } else if (firstObj !== -1 && lastObj > firstObj) {
    start = firstObj;
    end = lastObj + 1;
  } else {
    // Strategy 2: try parsing the whole thing
    try { return JSON.parse(cleaned); } catch {}
    throw new Error('No valid JSON found');
  }

  const jsonCandidate = cleaned.slice(start, end);

  // Strategy 3: try direct parse
  try { return JSON.parse(jsonCandidate); } catch (e) {
    // Strategy 4: fix common issues
    let fixed = jsonCandidate
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/,\s*$/gm, '')
      .replace(/\/\/.*$/gm, '');
    if (fixed !== jsonCandidate) {
      try { return JSON.parse(fixed); } catch {}
    }

    // Strategy 5: try to extract just the JSON-like part by counting braces
    try {
      let depth = 0;
      let jsonStart = -1;
      let jsonEnd = -1;
      for (let i = 0; i < jsonCandidate.length; i++) {
        const ch = jsonCandidate[i];
        if (ch === '{' || ch === '[') {
          if (depth === 0) jsonStart = i;
          depth++;
        } else if (ch === '}' || ch === ']') {
          depth--;
          if (depth === 0) { jsonEnd = i + 1; break; }
        }
      }
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        return JSON.parse(jsonCandidate.slice(jsonStart, jsonEnd));
      }
    } catch {}

    throw e;
  }
}

export const getIntervalMs = (interval: string) =>
  interval === 'hourly' ? 3600000 : interval === 'daily' ? 86400000 : 604800000;

export const formatNextRun = (ts: number) => {
  const diff = ts - Date.now();
  if (diff <= 0) return 'now';
  if (diff < 3600000) return `in ${Math.ceil(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.ceil(diff / 3600000)}h`;
  return `in ${diff / 86400000 >= 1 ? Math.ceil(diff / 86400000) : 0}d`;
};

export const notifId = () => (Date.now() % 100000) + Math.floor(Math.random() * 1000);

export const isNativePlatform = () =>
  typeof window !== 'undefined' &&
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform?.();
