import { logger } from '../utils/logger';
import { useTwinStore, type StyleProfile, type WritingSample } from '../store/useTwinStore';

const FORMAL_INDICATORS = /\b(?:regarding|however|therefore|furthermore|consequently|nevertheless|accordingly|thus|hence|pursuant|therein|whereby)\b/i;
const INFORMAL_INDICATORS = /\b(?:gonna|wanna|gotta|kinda|sorta|yeah|nah|dude|bro|cool|awesome|hey|btw|tbh|imo|idk)\b/i;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const TECH_INDICATORS = /\b(?:API|SDK|JSON|HTTP|async|deploy|config|endpoint|schema|query|mutation|cache|pipeline|docker|kubernetes|React|TypeScript|Node)\b/i;

export class GiaTwin {
  private analysisQueue: string[] = [];
  private analyzing = false;

  async learnFromMessage(text: string, context: WritingSample['context']): Promise<void> {
    if (!text || text.length < 10) return;

    const store = useTwinStore.getState();
    store.addSample({ text, context });

    this.analysisQueue.push(text);
    this.scheduleAnalysis();
  }

  private analysisTimeout: ReturnType<typeof setTimeout> | null = null;
  private scheduleAnalysis(): void {
    if (this.analysisTimeout) clearTimeout(this.analysisTimeout);
    this.analysisTimeout = setTimeout(() => this.runAnalysis(), 5000);
  }

  private async runAnalysis(): Promise<void> {
    if (this.analyzing) return;
    this.analyzing = true;

    try {
      const store = useTwinStore.getState();
      if (!store.twin || store.twin.samples.length < 3) {
        this.analyzing = false;
        return;
      }

      const recentSamples = store.twin.samples.slice(-50);
      const analysis = this.analyzeStyle(recentSamples);
      store.updateProfile(analysis);
    } catch (e) {
      logger.warn('[GiaTwin] Analysis error:', e);
    } finally {
      this.analyzing = false;
    }
  }

  private analyzeStyle(samples: WritingSample[]): Partial<StyleProfile> {
    const texts = samples.map((s) => s.text);
    const combined = texts.join(' ');

    const sentences = combined.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = combined.split(/\s+/).filter((w) => w.length > 0);

    const formalMatches = (combined.match(FORMAL_INDICATORS) || []).length;
    const informalMatches = (combined.match(INFORMAL_INDICATORS) || []).length;
    const totalIndicators = formalMatches + informalMatches || 1;
    const formality = formalMatches / totalIndicators;

    const avgSentenceLength = sentences.length > 0
      ? words.length / sentences.length
      : 15;

    const longSentences = sentences.filter((s) => s.split(/\s+/).length > 25).length;
    const verbosity = sentences.length > 0 ? longSentences / sentences.length : 0.3;

    const emojiCount = (combined.match(EMOJI_PATTERN) || []).length;
    const emojiUsage = Math.min(1, emojiCount / Math.max(1, words.length) * 20);

    const techMatches = (combined.match(TECH_INDICATORS) || []).length;
    const technicalLevel = Math.min(1, techMatches / Math.max(1, words.length) * 10);

    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    const vocabularyRichness = Math.min(1, uniqueWords.size / Math.max(1, words.length) * 3);

    const positiveWords = (combined.match(/\b(?:good|great|awesome|love|amazing|excellent|happy|perfect|wonderful|fantastic)\b/gi) || []).length;
    const negativeWords = (combined.match(/\b(?:bad|terrible|awful|hate|horrible|worst|poor|wrong|ugly|disgusting)\b/gi) || []).length;
    const totalSentiment = positiveWords + negativeWords || 1;
    const sentimentBias = positiveWords / totalSentiment;

    const bigrams = new Map<string, number>();
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i].toLowerCase()} ${words[i + 1].toLowerCase()}`;
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    const commonPhrases = [...bigrams.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count > 1)
      .slice(0, 10)
      .map(([phrase]) => phrase);

    return {
      formality: Math.round(formality * 100) / 100,
      verbosity: Math.round(verbosity * 100) / 100,
      emojiUsage: Math.round(emojiUsage * 100) / 100,
      technicalLevel: Math.round(technicalLevel * 100) / 100,
      sentimentBias: Math.round(sentimentBias * 100) / 100,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      vocabularyRichness: Math.round(vocabularyRichness * 100) / 100,
      commonPhrases,
    };
  }

  generatePersonalizedPrompt(): string {
    const store = useTwinStore.getState();
    if (!store.twin || store.twin.confidence < 0.3) return '';

    const profile = store.twin.styleProfile;
    const lines: string[] = ['## GIA Twin — User Style Profile'];

    if (profile.formality < 0.3) {
      lines.push('- User prefers casual, informal communication');
    } else if (profile.formality > 0.7) {
      lines.push('- User prefers formal, professional communication');
    }

    if (profile.verbosity > 0.6) {
      lines.push('- User tends to write detailed, verbose responses');
    } else if (profile.verbosity < 0.3) {
      lines.push('- User prefers concise, brief responses');
    }

    if (profile.emojiUsage > 0.3) {
      lines.push('- User frequently uses emoji in communication');
    }

    if (profile.technicalLevel > 0.6) {
      lines.push('- User is technically inclined, comfortable with jargon');
    }

    if (profile.commonPhrases.length > 0) {
      lines.push(`- Common phrases: ${profile.commonPhrases.slice(0, 5).join(', ')}`);
    }

    lines.push(`- Vocabulary richness: ${(profile.vocabularyRichness * 100).toFixed(0)}%`);

    const recentSamples = store.twin.samples.slice(-3);
    if (recentSamples.length > 0) {
      lines.push('\nRecent writing samples:');
      for (const sample of recentSamples) {
        lines.push(`> ${sample.text.slice(0, 200)}`);
      }
    }

    lines.push(`\nMatch confidence: ${(store.twin.confidence * 100).toFixed(0)}%`);
    return lines.join('\n');
  }

  async correctPreference(feedback: string): Promise<void> {
    const store = useTwinStore.getState();

    const correctionMatch = feedback.match(/(?:I (?:don'?t |do not )?(?:like|prefer|want|mean) )(.+)/i);
    if (correctionMatch) {
      store.setPreference(`correction:${Date.now()}`, correctionMatch[1].trim());
    }

    const preferenceMatch = feedback.match(/(?:actually|instead|rather)\s+(.+?)(?:\.|$)/i);
    if (preferenceMatch) {
      store.setPreference(`preference:${Date.now()}`, preferenceMatch[1].trim());
    }

    this.analysisQueue.push(feedback);
    this.scheduleAnalysis();
  }

  getStats(): { samplesCount: number; confidence: number; preferencesCount: number } {
    const twin = useTwinStore.getState().twin;
    return {
      samplesCount: twin?.samples.length || 0,
      confidence: twin?.confidence || 0,
      preferencesCount: Object.keys(twin?.preferences || {}).length,
    };
  }
}

export const giaTwin = new GiaTwin();
