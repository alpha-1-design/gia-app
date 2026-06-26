import { logger } from '../utils/logger';
import { useMemoryStore, type MemoryCategory } from '../store/useMemoryStore';
import { knowledgeGraphService } from './KnowledgeGraphService';

interface AutoMemoryConfig {
  enabled: boolean;
  extractEntities: boolean;
  extractPreferences: boolean;
  extractFacts: boolean;
  extractEmotions: boolean;
  minConfidence: number;
}

const DEFAULT_CONFIG: AutoMemoryConfig = {
  enabled: true,
  extractEntities: true,
  extractPreferences: true,
  extractFacts: true,
  extractEmotions: true,
  minConfidence: 0.4,
};

const PREFERENCE_PATTERNS = [
  { pattern: /\bI (?:like|love|enjoy|prefer)\b/i, category: 'preference' as MemoryCategory },
  { pattern: /\bI don'?t (?:like|love|enjoy|prefer)\b/i, category: 'preference' as MemoryCategory },
  { pattern: /\bmy favorite\b/i, category: 'preference' as MemoryCategory },
  { pattern: /\bI (?:usually|always|never|often|sometimes)\b/i, category: 'habit' as MemoryCategory },
];

const FACT_PATTERNS = [
  { pattern: /\bI (?:am|work|live|study|have|use)\b/i, category: 'profile' as MemoryCategory },
  { pattern: /\bmy (?:name is|project|goal)\b/i, category: 'profile' as MemoryCategory },
  { pattern: /\b(?:I think|I believe|I feel)\b/i, category: 'subject' as MemoryCategory },
  { pattern: /\b(?:actually|the truth is|it turns out)\b/i, category: 'fact' as MemoryCategory },
];

const EMOTION_PATTERNS = [
  { pattern: /\b(?:happy|excited|grateful|glad|thrilled|amazing|wonderful)\b/i, label: 'positive' },
  { pattern: /\b(?:sad|upset|frustrated|annoyed|angry|mad|disappointed)\b/i, label: 'negative' },
  { pattern: /\b(?:anxious|worried|nervous|stressed|overwhelmed|tired|exhausted)\b/i, label: 'anxious' },
];

export class AutoMemory {
  private config: AutoMemoryConfig = { ...DEFAULT_CONFIG };
  private processedMessages = new Set<string>();
  private processingQueue: string[] = [];
  private processing = false;

  updateConfig(updates: Partial<AutoMemoryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  async processMessage(text: string, messageId: string, role: 'user' | 'assistant'): Promise<void> {
    if (!this.config.enabled || !text || text.length < 5) return;
    if (this.processedMessages.has(messageId)) return;

    this.processingQueue.push(text);
    if (this.processing) return;

    this.processing = true;
    while (this.processingQueue.length > 0) {
      const msg = this.processingQueue.shift()!;
      await this.analyzeAndStore(msg, messageId, role);
    }
    this.processing = false;
  }

  private async analyzeAndStore(text: string, messageId: string, role: 'user' | 'assistant'): Promise<void> {
    try {
      this.processedMessages.add(messageId);
      if (this.processedMessages.size > 1000) {
        const first = this.processedMessages.values().next().value;
        if (first) this.processedMessages.delete(first);
      }

      const knowledgeStore = useMemoryStore.getState();

      if (role === 'user') {
        if (this.config.extractPreferences) {
          for (const { pattern, category } of PREFERENCE_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
              const value = text.slice(match.index! + match[0].length).trim().replace(/^[,.:\s]+/, '').split(/[.!?]/)[0].trim();
              if (value && value.length > 3 && value.length < 200) {
                knowledgeStore.addMemory({
                  key: `preference:${value.slice(0, 40).toLowerCase().replace(/\s+/g, '_')}`,
                  value,
                  category,
                  tier: 'semantic',
                  confidence: Math.min(1, 0.5 + text.length / 1000),
                });
              }
            }
          }
        }

        if (this.config.extractFacts) {
          for (const { pattern, category } of FACT_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
              const value = text.slice(match.index! + match[0].length).trim().replace(/^[,.:\s]+/, '').split(/[.!?]/)[0].trim();
              if (value && value.length > 5 && value.length < 300) {
                knowledgeStore.addMemory({
                  key: `fact:${value.slice(0, 40).toLowerCase().replace(/\s+/g, '_')}`,
                  value,
                  category,
                  tier: 'episodic',
                  confidence: 0.6,
                });
              }
            }
          }
        }

        if (this.config.extractEmotions) {
          for (const { pattern, label } of EMOTION_PATTERNS) {
            if (pattern.test(text)) {
              knowledgeStore.addMemory({
                key: `emotion_state`,
                value: `User expressed ${label} emotions: ${text.slice(0, 150)}`,
                category: 'emotion',
                tier: 'working',
                confidence: 0.7,
              });
              break;
            }
          }
        }
      }

      if (this.config.extractEntities && text.length > 50) {
        this.scheduleEntityExtraction(text, messageId);
      }

      knowledgeStore.addMemory({
        key: `session:${new Date().toISOString().slice(0, 10)}`,
        value: `${role}: ${text.slice(0, 300)}`,
        category: 'session_summary',
        tier: 'episodic',
        confidence: 0.3,
      });
    } catch (e) {
      logger.warn('[AutoMemory] Error processing message:', e);
    }
  }

  private entityTimeout: ReturnType<typeof setTimeout> | null = null;
  private scheduleEntityExtraction(text: string, messageId: string): void {
    if (this.entityTimeout) clearTimeout(this.entityTimeout);
    this.entityTimeout = setTimeout(() => {
      knowledgeGraphService.extractFromText(text, messageId).catch(() => {});
      this.entityTimeout = null;
    }, 2000);
  }

  getSystemPromptInjections(): string {
    const recent = useMemoryStore.getState().memories
      .filter((m) => m.tier === 'working')
      .slice(0, 5);
    if (recent.length === 0) return '';

    return '\n\n## Auto-detected context:\n' + recent
      .map((m) => `- ${m.key}: ${m.value}`)
      .join('\n');
  }

  getProcessingStats(): { processedCount: number; queueLength: number } {
    return {
      processedCount: this.processedMessages.size,
      queueLength: this.processingQueue.length,
    };
  }
}

export const autoMemory = new AutoMemory();
