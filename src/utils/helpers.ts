export function extractJSON(text: string): any {
  let cleaned = text.replace(/```json|```/g, '').trim();

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
    throw new Error('No valid JSON found');
  }

  const jsonCandidate = cleaned.slice(start, end);
  
  try {
    return JSON.parse(jsonCandidate);
  } catch (e) {
    let fixed = jsonCandidate
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/,\s*$/gm, '')
      .replace(/\/\/.*$/gm, '');
    if (fixed !== jsonCandidate) {
      try { return JSON.parse(fixed); } catch {}
    }
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
  return `in ${Math.ceil(diff / 86400000)}d`;
};

export const notifId = () => (Date.now() % 100000) + Math.floor(Math.random() * 1000);
