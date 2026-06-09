import { logger } from '../utils/logger';

export interface SanitizeResult {
  safe: boolean;
  content: string;
  warnings: string[];
  risk: 'safe' | 'suspicious' | 'dangerous';
  injectionPatterns: string[];
}

// Patterns that suggest prompt injection in web content
const INJECTION_PATTERNS: { pattern: RegExp; label: string; severity: 'warn' | 'block' }[] = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directions|commands|prompts)/i, label: 'instruction-override', severity: 'block' },
  { pattern: /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|directions|commands)/i, label: 'instruction-forget', severity: 'block' },
  { pattern: /you\s+(are\s+)?(now|will\s+now\s+act\s+as)\s+/i, label: 'role-play-override', severity: 'warn' },
  { pattern: /new\s+(instructions|system\s+prompt|task|directive):/i, label: 'new-instructions', severity: 'warn' },
  { pattern: /override\s+(your|the|all)\s+(system|instructions|prompt)/i, label: 'prompt-override', severity: 'block' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)/i, label: 'disregard-prior', severity: 'block' },
  { pattern: /you\s+must\s+(not|never)\s+(tell|reveal|share|disclose|mention)/i, label: 'suppression-attempt', severity: 'warn' },
  { pattern: /say\s+(the\s+)?(word|phrase|text)\s+["'].*?["']/i, label: 'forced-output', severity: 'warn' },
  { pattern: /repeat\s+(after\s+me|the\s+following|this\s+exactly)/i, label: 'forced-repetition', severity: 'warn' },
  { pattern: /(this\s+is\s+)?(a\s+)?(test|simulation|experiment).*(your\s+)?(instructions|prompt|directives)/i, label: 'meta-test-prompt', severity: 'warn' },
  { pattern: /output\s+(only|just|exactly)\s+(the\s+)?(word|phrase|json|text)/i, label: 'constrained-output', severity: 'warn' },
];

// CSS properties that hide content
const HIDING_PATTERNS = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /opacity\s*:\s*0(\.0+)?/i,
  /position\s*:\s*absolute/i,
  /position\s*:\s*fixed/i,
  /clip\s*:\s*rect\(0,\s*0,\s*0,\s*0\)/i,
  /width\s*:\s*0/i,
  /height\s*:\s*0/i,
  /font-size\s*:\s*0/i,
  /text-indent\s*:\s*-\d+/i,
  /margin-[a-z]+\s*:\s*-\d+/i,
  /z-index\s*:\s*-\d+/i,
  /aria-hidden\s*=\s*["']true["']/i,
  /hidden\s*>/i,
  /type\s*=\s*["']hidden["']/i,
];

class WebContentSanitizer {
  private static instance: WebContentSanitizer;

  static getInstance() {
    if (!this.instance) this.instance = new WebContentSanitizer();
    return this.instance;
  }

  sanitize(input: string, source: string = 'unknown'): SanitizeResult {
    if (!input || input.length === 0) {
      return { safe: true, content: input, warnings: [], risk: 'safe', injectionPatterns: [] };
    }

    const warnings: string[] = [];
    const injectionPatterns: string[] = [];
    let content = input;
    let highestRisk: 'safe' | 'suspicious' | 'dangerous' = 'safe';

    // 1. Strip zero-width and invisible Unicode characters
    const zwBefore = content.length;
    content = content.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u180E]/g, '');
    if (content.length !== zwBefore) {
      warnings.push(`Stripped ${zwBefore - content.length} zero-width/invisible Unicode characters`);
    }

    // 2. Decode and strip base64-encoded blobs (potential hidden payloads)
    const b64Candidates = content.match(/[A-Za-z0-9+/=]{40,}/g);
    if (b64Candidates) {
      let strippedCount = 0;
      for (const candidate of b64Candidates) {
        try {
          const decoded = atob(candidate);
          // Check if decoded contains instructions
          if (
            decoded.length > 10 &&
            decoded.length < 2000 &&
            /ignore|override|you are|instructions|system prompt/i.test(decoded)
          ) {
            content = content.replace(candidate, '[base64-encoded content stripped]');
            strippedCount++;
            injectionPatterns.push('base64-encoded-instructions');
            warnings.push(`Stripped ${strippedCount} base64-encoded payload(s) containing potential instructions`);
          }
        } catch {
          // Not valid base64, skip
        }
      }
    }

    // 3. Strip HTML comments (often used to hide instructions)
    const commentMatches = content.match(/<!--[\s\S]*?-->/g);
    const suspiciousComments = (commentMatches || []).filter(c => {
      const lower = c.toLowerCase();
      return /ignore|override|instructions|system prompt|you are now/i.test(lower);
    });
    if (suspiciousComments.length > 0) {
      injectionPatterns.push('suspicious-html-comments');
      warnings.push(`Found ${suspiciousComments.length} HTML comment(s) with potential injection patterns`);
      for (const sc of suspiciousComments) {
        content = content.replace(sc, '[suspicious comment removed]');
      }
    }

    // 4. Strip elements with CSS hiding properties
    for (const pattern of HIDING_PATTERNS) {
      if (pattern.test(content)) {
        // Remove inline style or class references that hide content
        // This is a heuristic — we remove blocks that contain hidden elements
        const styleBlockMatch = content.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
        if (styleBlockMatch) {
          for (const styleBlock of styleBlockMatch) {
            if (pattern.test(styleBlock)) {
              content = content.replace(styleBlock, '');
              warnings.push(`Removed <style> block with ${pattern.source} pattern`);
            }
          }
        }

        // Strip elements with inline hiding styles
        const elementRegex = new RegExp(
          `<[^>]+style\\s*=\\s*["'][^"']*${pattern.source}[^"']*["'][^>]*>[\\s\\S]*?<\\/[^>]+>`,
          'gi'
        );
        let match;
        while ((match = elementRegex.exec(content)) !== null) {
          const innerText = match[0].replace(/<[^>]+>/g, '').trim();
          if (innerText.length > 0) {
            const lower = innerText.toLowerCase();
            if (/ignore|override|instructions|system prompt|you are now/i.test(lower)) {
              content = content.replace(match[0], '');
              warnings.push(`Removed hidden element containing: "${innerText.slice(0, 60)}..."`);
            }
          }
        }
      }
    }

    // 5. Check for prompt injection patterns in the visible content
    for (const rule of INJECTION_PATTERNS) {
      if (rule.pattern.test(content)) {
        injectionPatterns.push(rule.label);
        if (rule.severity === 'block') {
          highestRisk = 'dangerous';
        } else if (highestRisk !== 'dangerous') {
          highestRisk = 'suspicious';
        }
        warnings.push(`Detected: ${rule.label} — ${rule.severity === 'block' ? 'potential prompt injection' : 'suspicious pattern'}`);
      }
    }

    // 6. Strip common SEO spam patterns (keyword stuffing, repetitive text)
    const words = content.split(/\s+/);
    const freq: Record<string, number> = {};
    const seoWords = ['buy', 'cheap', 'price', 'discount', 'click here', 'free', 'subscribe', 'order now'];
    let seoScore = 0;
    for (const word of words) {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (clean.length < 3) continue;
      freq[clean] = (freq[clean] || 0) + 1;
      if (seoWords.includes(clean)) seoScore++;
    }
    // If more than 15% of the content is SEO keywords, flag it
    if (seoScore > 10 && seoScore > words.length * 0.15) {
      warnings.push(`High SEO keyword density detected (${seoScore}/${words.length} words) — content may be spam`);
      if (highestRisk === 'safe') highestRisk = 'suspicious';
    }

    // 7. Check for hidden text via same-color trick (color matching background)
    const colorPatterns = [
      /color\s*:\s*#[0f]{3,6}/i,  // black or white colored text
    ];
    for (const cp of colorPatterns) {
      if (cp.test(content)) {
        warnings.push('Detected possible same-color hidden text (color-based hiding)');
      }
    }

    // 8. Detect attempts to create "branches" or alternative personas
    const branchingPatterns = [
      /you\s+are\s+now\s+in\s+(a\s+)?(branch|fork|alternate|simulation|sandbox)/i,
      /this\s+is\s+(a\s+)?(test|simulation|separate|isolated)\s+(environment|context|session)/i,
      /the\s+following\s+is\s+(a\s+)?(separate|new|independent)\s+(task|instruction|thread)/i,
    ];
    for (const bp of branchingPatterns) {
      if (bp.test(content)) {
        injectionPatterns.push('branching-attempt');
        warnings.push('Detected possible branching/simulation framing — content trying to create alternate context');
        if (highestRisk !== 'dangerous') highestRisk = 'suspicious';
      }
    }

    // 9. Final cleanup — strip remaining HTML tags and normalize whitespace
    content = content
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (warnings.length > 0) {
      logger.warn(`[WebContentSanitizer] ${source}: ${warnings.join('; ')}`);
    }

    return {
      safe: highestRisk !== 'dangerous',
      content,
      warnings,
      risk: highestRisk,
      injectionPatterns,
    };
  }

  /**
   * Returns a safety summary for logging/UI display
   */
  summarize(result: SanitizeResult): string {
    if (result.risk === 'safe' && result.warnings.length === 0) return '';
    const parts: string[] = [];
    if (result.risk === 'dangerous') parts.push('⚠️ DANGEROUS — prompt injection blocked');
    else if (result.risk === 'suspicious') parts.push('⚠️ Suspicious content detected');
    if (result.injectionPatterns.length > 0) parts.push(`patterns: ${result.injectionPatterns.join(', ')}`);
    if (result.warnings.length > 0) parts.push(result.warnings[0]);
    return parts.join(' | ');
  }
}

export default WebContentSanitizer.getInstance();
