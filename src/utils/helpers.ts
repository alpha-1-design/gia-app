import { logger } from './logger';

export function extractJSON<T = unknown>(text: string): T {
  const cleaned = text
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
  } else if (firstObj !== -1 && lastObj === -1) {
    start = firstObj;
    end = cleaned.length;
  } else if (firstArray !== -1 && lastArray === -1) {
    start = firstArray;
    end = cleaned.length;
  } else {
    // Strategy 2: try parsing the whole thing
    try { return JSON.parse(cleaned); } catch (e) { logger.error('[helpers] JSON parse failed (strategy 2):', e); }
    throw new Error('No valid JSON found');
  }

  const jsonCandidate = cleaned.slice(start, end);

  // Strategy 3: try direct parse
  try { return JSON.parse(jsonCandidate); } catch (e) {
    // Strategy 4: fix common issues
    const fixed = jsonCandidate
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/,\s*$/gm, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/([\s\S]*?)([{[]).*/, '$2') // Remove text before first { or [
      .replace(/.*([}\]])[\s\S]*/, '$1'); // Remove text after last } or ]

    // Strategy 4b: handle broken/incomplete lines - try to complete truncated JSON
    if (fixed !== jsonCandidate) {
      try { return JSON.parse(fixed); } catch (e) { logger.error('[helpers] JSON parse failed (strategy 4):', e); }
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
    } catch (e) { logger.error('[helpers] JSON parse failed (strategy 5):', e); }

    // Strategy 6: try to repair truncated JSON by adding missing closing brackets
    try {
      const repaired = repairTruncatedJSON(jsonCandidate);
      if (repaired !== jsonCandidate) {
        return JSON.parse(repaired);
      }
    } catch (e) { logger.error('[helpers] JSON parse failed (strategy 6):', e); }

    throw e;
  }
}

function repairTruncatedJSON(json: string): string {
  let result = json;
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  // Count unclosed brackets/braces
  for (let i = 0; i < result.length; i++) {
    const ch = result[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (ch === '"' && !escapeNext) { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') depth--;
    }
  }

  // Close unclosed string if needed
  if (inString) {
    result += '"';
    inString = false;
  }

  // Add missing closing brackets
  while (depth > 0) {
    // Check if we're in an object or array context
    let lastOpenType = '';
    let tempInString = false;
    let tempEscape = false;
    for (let i = 0; i < result.length; i++) {
      const ch = result[i];
      if (tempEscape) { tempEscape = false; continue; }
      if (ch === '\\') { tempEscape = true; continue; }
      if (ch === '"' && !tempEscape) { tempInString = !tempInString; continue; }
      if (!tempInString) {
        if (ch === '{' || ch === '[') { lastOpenType = ch; }
      }
    }
    if (lastOpenType === '{') result += '}';
    else if (lastOpenType === '[') result += ']';
    depth--;
  }

  // Fix trailing commas before closing brackets
  result = result.replace(/,\s*([\]}])/g, '$1');

  // Fix unquoted keys
  result = result.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Fix unclosed strings at the end
  if (result.match(/[^\\]"$/)) {
    result += '"';
  }

  return result;
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

interface CapacitorWindow {
  Capacitor?: { isNativePlatform?: () => boolean };
}
export const isNativePlatform = (): boolean => {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  if (typeof cap === 'undefined') return false;
  return typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : true;
};

const platformFeatures = {
  filesystem: { supported: isNativePlatform(), label: 'File system access', webFallback: 'Download only — files saved as downloads' },
  biometrics: { supported: isNativePlatform(), label: 'Biometric authentication', webFallback: 'Not available in browser' },
  voice: { supported: isNativePlatform() || 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window, label: 'Voice recognition', webFallback: 'Browser speech recognition available' },
  tts: { supported: isNativePlatform() || 'speechSynthesis' in window, label: 'Text-to-speech', webFallback: 'Browser TTS available' },
  notifications: { supported: isNativePlatform() || 'Notification' in window, label: 'Desktop notifications', webFallback: 'Browser notifications available' },
  codeRunner: { supported: true, label: 'Code execution', webFallback: 'Limited sandbox' },
  browserNav: { supported: true, label: 'Browser navigation', webFallback: 'CORS proxy may be needed' },
};

type PlatformFeature = keyof typeof platformFeatures;

export function featureAvailable(feature: PlatformFeature): boolean {
  return platformFeatures[feature]?.supported ?? false;
}

export function featureFallbackMessage(feature: PlatformFeature): string {
  const f = platformFeatures[feature];
  if (!f) return 'Not available';
  return f.supported ? '' : `${f.label}: ${f.webFallback}`;
}
