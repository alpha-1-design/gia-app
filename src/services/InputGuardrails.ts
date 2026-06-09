export interface GuardrailResult {
  passed: boolean;
  risk: 'safe' | 'suspicious' | 'blocked';
  reason: string | null;
  sanitized: string;
}

interface GuardrailPattern {
  name: string;
  patterns: RegExp[];
  risk: 'suspicious' | 'blocked';
  message: string;
}

const PROMPT_INJECTION_PATTERNS: GuardrailPattern[] = [
  {
    name: 'system-prompt-override',
    patterns: [
      /ignore\s+(all\s+)?(previous|prior|above).*(instructions|directions|commands)/i,
      /forget\s+(all\s+)?(previous|prior|above)/i,
      /you\s+(are\s+)?(now|will\s+now\s+act\s+as)\s+(?!.*(assistant|help|gia))/i,
      /new\s+(instructions|system\s+prompt|task):/i,
      /override\s+(system|instructions)/i,
    ],
    risk: 'suspicious',
    message: 'Prompt contains possible system prompt override attempt',
  },
  {
    name: 'dangerous-command',
    patterns: [
      /rm\s+-rf\s+\//,
      /format\s+(drive|disk|volume)/i,
      /drop\s+table/i,
      /shutdown\s+(-h|-r|-now)/i,
      />\s*\/dev\/sda/i,
    ],
    risk: 'blocked',
    message: 'Prompt contains dangerous system commands',
  },
  {
    name: 'data-exfiltration',
    patterns: [
      /send\s+(my|all|the)\s+(data|files|keys|passwords|secrets)/i,
      /exfiltrat/i,
      /upload\s+(to|all)\s+(my|the)\s+(data|files)/i,
    ],
    risk: 'suspicious',
    message: 'Prompt requests data exfiltration',
  },
];

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

class InputGuardrails {
  private static instance: InputGuardrails;

  static getInstance() {
    if (!this.instance) this.instance = new InputGuardrails();
    return this.instance;
  }

  async check(input: string): Promise<GuardrailResult> {
    const sanitized = input;
    let highestRisk: 'safe' | 'suspicious' | 'blocked' = 'safe';
    let reason: string | null = null;

    for (const rule of PROMPT_INJECTION_PATTERNS) {
      for (const pattern of rule.patterns) {
        if (pattern.test(sanitized)) {
          if (rule.risk === 'blocked') {
            highestRisk = 'blocked';
            reason = rule.message;
            break;
          }
          if (rule.risk === 'suspicious' && highestRisk === 'safe') {
            highestRisk = 'suspicious';
            reason = rule.message;
          }
        }
      }
      if (highestRisk === 'blocked') break;
    }

    const matches = sanitized.match(URL_PATTERN);
    if (matches && matches.length > 3) {
      const suspiciousUrls = matches.filter(u => {
        const host = u.toLowerCase();
        return /(bit\.ly|tinyurl|shorturl|shorte|shrink)/i.test(host);
      });
      if (suspiciousUrls.length > 0 && highestRisk !== 'blocked') {
        highestRisk = 'suspicious';
        reason = 'Prompt contains shortened URLs that may be unsafe';
      }
    }

    return { passed: highestRisk !== 'blocked', risk: highestRisk, reason, sanitized };
  }

  sanitize(input: string): string {
    return input
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '[script removed]')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript\s*:/gi, '')
      .trim();
  }
}

export default InputGuardrails.getInstance();
