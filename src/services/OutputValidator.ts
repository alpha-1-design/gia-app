import { repairJson, findFenceClose } from '../utils/jsonRepair';

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  issues: string[];
}

class OutputValidator {
  private static instance: OutputValidator;

  static getInstance() {
    if (!this.instance) this.instance = new OutputValidator();
    return this.instance;
  }

  validate(text: string): ValidationResult {
    const issues: string[] = [];
    let sanitized = text;

    const toolBlockCount = (sanitized.match(/```tool/g) || []).length;
    const toolBlockEndCount = (sanitized.match(/```\n/g) || []).length;
    if (toolBlockCount > toolBlockEndCount) {
      sanitized += '\n```';
      issues.push('Added missing closing fence for tool block');
    }

    const thinkOpen = (sanitized.match(/<think>/g) || []).length;
    const thinkClose = (sanitized.match(/<\/think>/g) || []).length;
    if (thinkOpen > thinkClose) {
      sanitized += '</think>';
      issues.push('Added missing </think> closing tag');
    }

    // Use findFenceClose to properly handle nested backticks inside JSON
    const jsonBlocks: string[] = [];
    let ovPos = 0;
    while (ovPos < sanitized.length) {
      const fbIdx = sanitized.indexOf('```', ovPos);
      if (fbIdx < 0) break;
      const afterLang = sanitized.slice(fbIdx + 3);
      const isJsonFence = afterLang.startsWith('json') || afterLang.startsWith('\n') || afterLang.startsWith(' ');
      if (!isJsonFence) { ovPos = fbIdx + 3; continue; }
      const bodyStart = fbIdx + 3 + (afterLang.startsWith('json') ? 4 : 0);
      const contentStart = sanitized[bodyStart] === '\n' ? bodyStart + 1 : bodyStart;
      const closeIdx = findFenceClose(sanitized, contentStart);
      if (closeIdx < 0) break;
      jsonBlocks.push(sanitized.slice(fbIdx, closeIdx + 3));
      ovPos = closeIdx + 3;
    }
    if (jsonBlocks.length > 0) {
      for (const block of jsonBlocks) {
        try {
          const jsonStr = block.replace(/```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
          JSON.parse(jsonStr);
        } catch {
          try {
            const jsonStr = block.replace(/```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
            const repaired = repairJson(jsonStr);
            const repairedBlock = block.replace(jsonStr, repaired);
            sanitized = sanitized.replace(block, repairedBlock);
            issues.push('Repaired malformed JSON in code block');
          } catch {
            issues.push('Could not repair malformed JSON block');
          }
        }
      }
    }

    const consecutiveNewlines = sanitized.match(/\n{4,}/g);
    if (consecutiveNewlines) {
      sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');
      issues.push('Collapsed excessive consecutive newlines');
    }

    // Only remove repeated patterns that are clearly stuck repeats (same word/phrase 5+ times)
    const stuckPattern = /(\b\w{3,}\b)(?:[^a-zA-Z]+\1){4,}/g;
    if (stuckPattern.test(sanitized)) {
      sanitized = sanitized.replace(stuckPattern, '$1');
      issues.push('Removed stuck repeated word pattern');
    }

    // Remove single character repeated > 50 times in a row (stuck key)
    const stuckChar = /(.)\1{50,}/g;
    if (stuckChar.test(sanitized)) {
      sanitized = sanitized.replace(stuckChar, '');
      issues.push('Removed stuck character repetition');
    }

    return { valid: issues.length === 0, sanitized, issues };
  }
}

export default OutputValidator.getInstance();
