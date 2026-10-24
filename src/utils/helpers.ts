export function extractJSON<T = unknown>(text: string): T {
  const cleaned = stripThinking(text)
    .replace(/```tool[\s\S]*?```/g, '')
    .trim();

  // The whole response is already JSON in the common case.
  const whole = tryParseJson<T>(cleaned);
  if (whole.ok) return whole.value;

  // Models often show a schema example before the real payload, or write a
  // short citation after it. Prefer the largest balanced value; ties go to
  // the later one. Think blocks are removed before this scan, so examples
  // inside them cannot win.
  const candidates = findJsonCandidates(cleaned)
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value.length - a.value.length || b.index - a.index);
  for (const candidate of candidates) {
    const parsed = tryParseJson<T>(candidate.value);
    if (parsed.ok) return parsed.value;
  }

  throw new Error('No valid JSON found');
}

function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi, '')
    .replace(/<\|begin_of_solution\|>[\s\S]*?<\|end_of_solution\|>/gi, '')
    .replace(/<\|(?:begin|end)_of_(?:thought|solution)\|>/gi, '');
}

interface ParseAttempt<T> {
  ok: true;
  value: T;
}

function tryParseJson<T>(candidate: string): ParseAttempt<T> | { ok: false } {
  const trimmed = candidate.trim();
  if (!trimmed) return { ok: false };

  try {
    return { ok: true, value: JSON.parse(trimmed) as T };
  } catch {
    // Fall through to the repair passes.
  }

  const fixed = trimmed
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/,\s*$/gm, '')
    .replace(/\/\/.*$/gm, '');
  if (fixed !== trimmed) {
    try {
      return { ok: true, value: JSON.parse(fixed) as T };
    } catch {
      // Fall through to truncated-JSON repair.
    }
  }

  const repaired = repairTruncatedJSON(trimmed);
  if (repaired !== trimmed) {
    try {
      return { ok: true, value: JSON.parse(repaired) as T };
    } catch {
      // The candidate is genuinely invalid.
    }
  }

  return { ok: false };
}

function findJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char !== '{' && char !== '[') {
      index++;
      continue;
    }
    const end = findBalancedEnd(text, index);
    if (end > index) {
      candidates.push(text.slice(index, end));
      index = end;
    } else {
      index++;
    }
  }
  return candidates;
}

function findBalancedEnd(text: string, start: number): number {
  const closers: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      closers.push('}');
    } else if (char === '[') {
      closers.push(']');
    } else if (char === '}' || char === ']') {
      if (closers.pop() !== char) return -1;
      if (closers.length === 0) return i + 1;
    }
  }

  // Truncated response: return the rest so the repair pass can close it.
  return text.length;
}

function repairTruncatedJSON(json: string): string {
  let result = json;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < result.length; i++) {
    const ch = result[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack[stack.length - 1] === ch) stack.pop();
    }
  }

  if (inString) result += '"';
  while (stack.length > 0) result += stack.pop();

  // Fix trailing commas before closing brackets and unquoted keys.
  result = result.replace(/,\s*([\]}])/g, '$1');
  result = result.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

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
