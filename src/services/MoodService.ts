import { useMoodStore, type MoodLabel } from '../store/useMoodStore';

const POSITIVE_WORDS = new Set([
  'happy', 'great', 'awesome', 'love', 'amazing', 'excellent', 'perfect',
  'wonderful', 'fantastic', 'good', 'beautiful', 'grateful', 'excited',
  'thrilled', 'glad', 'joy', 'peaceful', 'calm', 'confident', 'proud',
  'hopeful', 'inspired', 'motivated', 'energized', 'bright',
]);

const NEGATIVE_WORDS = new Set([
  'sad', 'bad', 'terrible', 'awful', 'hate', 'horrible', 'worst',
  'poor', 'wrong', 'ugly', 'disgusting', 'angry', 'frustrated',
  'annoyed', 'upset', 'depressed', 'lonely', 'hurt', 'tired',
  'exhausted', 'stressed', 'anxious', 'worried', 'scared', 'afraid',
  'hopeless', 'disappointed', 'regret', 'guilty', 'ashamed',
]);

const VERY_POSITIVE_WORDS = new Set([
  'ecstatic', 'euphoric', 'elated', 'overjoyed', 'thrilled',
  'phenomenal', 'extraordinary', 'incredible', 'magnificent',
]);

const VERY_NEGATIVE_WORDS = new Set([
  'devastated', 'despair', 'miserable', 'heartbroken', 'crushed',
  'hopeless', 'suicidal', 'terrified', 'traumatized',
]);

export class MoodService {
  analyzeSentiment(text: string): { label: MoodLabel; score: number } {
    const words = text.toLowerCase().split(/\s+/);

    let score = 0;

    for (const word of words) {
      if (VERY_POSITIVE_WORDS.has(word)) { score += 0.8; }
      else if (POSITIVE_WORDS.has(word)) { score += 0.3; }
      else if (NEGATIVE_WORDS.has(word)) { score -= 0.3; }
      else if (VERY_NEGATIVE_WORDS.has(word)) { score -= 0.8; }
    }

    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;

    score += exclamationCount * 0.1;
    score -= questionCount * 0.05;

    const uppercaseRatio = text.length > 0
      ? (text.match(/[A-Z]/g) || []).length / text.length
      : 0;
    if (uppercaseRatio > 0.5 && text.length > 10) {
      score += uppercaseRatio * 0.3;
    }

    const normalizedScore = Math.max(-1, Math.min(1, score));

    let label: MoodLabel;
    if (normalizedScore > 0.5) label = 'very_positive';
    else if (normalizedScore > 0.1) label = 'positive';
    else if (normalizedScore < -0.5) label = 'very_negative';
    else if (normalizedScore < -0.1) label = 'negative';
    else label = 'neutral';

    return { label, score: normalizedScore };
  }

  recordMood(text: string, source: 'message' | 'voice' | 'manual' | 'automatic'): void {
    if (!text || text.length < 3) return;
    const { label, score } = this.analyzeSentiment(text);
    useMoodStore.getState().addEntry({ label, score, context: text.slice(0, 200), source });
  }

  getMoodAdaptation(): string {
    const store = useMoodStore.getState();
    const current = store.getCurrentMood();

    switch (current) {
      case 'very_negative':
        return 'Show extra empathy, offer support, keep responses gentle and reassuring';
      case 'negative':
        return 'Be understanding and supportive, avoid humor, offer practical help';
      case 'neutral':
        return 'Standard response mode, match user tone';
      case 'positive':
        return 'Match enthusiasm, engage warmly, be encouraging';
      case 'very_positive':
        return 'Match high energy, share excitement, be celebratory';
    }
  }

  detectMoodChange(): boolean {
    const entries = useMoodStore.getState().entries;
    if (entries.length < 5) return false;

    const recent = entries.slice(-3);
    const older = entries.slice(-6, -3);

    const recentAvg = recent.reduce((s, e) => s + e.score, 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + e.score, 0) / older.length;

    return Math.abs(recentAvg - olderAvg) > 0.4;
  }

  async analyzePeriod(hours = 168): Promise<string> {
    const store = useMoodStore.getState();
    const trend = store.getMoodTrend(hours);
    const summary = store.getMoodSummary(hours);

    if (Math.abs(trend) < 0.1) {
      return summary + '\nMood has been relatively stable.';
    }

    const direction = trend > 0 ? 'positive' : 'negative';
    const intensity = Math.abs(trend) > 0.4 ? 'significantly' : 'slightly';

    return `${summary}\nMood has been trending ${direction} (${intensity}) over the last ${hours}h period.`;
  }

  generateMoodContext(): string {
    const store = useMoodStore.getState();
    const current = store.getCurrentMood();
    const trend24h = store.getMoodTrend(24);
    const recentEntries = store.getRecentMoods(5);

    if (recentEntries.length === 0) return '';

    const lines: string[] = ['## Mood Context:'];
    lines.push(`Current: ${current} (${trend24h > 0 ? 'improving' : 'declining'} over 24h)`);

    if (this.detectMoodChange()) {
      lines.push('Note: Significant mood shift detected recently');
    }

    return lines.join('\n');
  }

  getSystemInstruction(): string {
    return this.getMoodAdaptation() ? `[Mood Adaptation: ${this.getMoodAdaptation()}]` : '';
  }
}

export const moodService = new MoodService();
