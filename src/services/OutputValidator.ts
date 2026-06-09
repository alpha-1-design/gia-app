import { repairJson } from '../utils/jsonRepair';

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

    const jsonBlocks = sanitized.match(/```(?:json)?\s*\n?({[\s\S]*?})\n?```/g);
    if (jsonBlocks) {
      for (const block of jsonBlocks) {
        try {
          const jsonStr = block.replace(/```(?:json)?\s*\n?/, '').replace(/\n?```/, '');
          JSON.parse(jsonStr);
        } catch {
          try {
            const jsonStr = block.replace(/```(?:json)?\s*\n?/, '').replace(/\n?```/, '');
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

    const repeatPattern = /(.{20,}?)\1{3,}/g;
    if (repeatPattern.test(sanitized)) {
      sanitized = sanitized.replace(repeatPattern, '$1');
      issues.push('Removed repeated text patterns');
    }

    const totalLen = sanitized.length;
    const charCounts: Record<string, number> = {};
    for (const ch of sanitized) {
      charCounts[ch] = (charCounts[ch] || 0) + 1;
    }
    for (const [ch, count] of Object.entries(charCounts)) {
      if (count > totalLen * 0.4 && totalLen > 50) {
        sanitized = sanitized.replace(new RegExp(`[${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g'), '');
        issues.push(`Removed over-represented character "${ch}"`);
        break;
      }
    }

    return { valid: issues.length === 0, sanitized, issues };
  }
}

export default OutputValidator.getInstance();
