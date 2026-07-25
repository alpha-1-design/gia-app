export interface ActivityPattern {
  hour: number;
  dayOfWeek: number;
  activityType: string;
  frequency: number;
  lastObserved: Date;
}

export interface SmartTask {
  id: string;
  name: string;
  activityType: string;
  estimatedDuration: number;
  priority: "low" | "medium" | "high";
}

export interface TimeSlotPrediction {
  activityType: string;
  bestHour: number;
  bestDayOfWeek: number;
  confidence: number;
  reason: string;
}

export interface PatternReport {
  totalPatterns: number;
  topActivityTypes: Array<{ type: string; totalFrequency: number }>;
  mostActiveHour: number | null;
  mostActiveDay: number | null;
  hourlyDistribution: number[];
  dailyDistribution: number[];
  oldestPatternAge: number | null;
  newestPatternAge: number | null;
  summary: string;
}

const MAX_PATTERNS = 500;
const DECAY_DAYS = 30;
const DECAY_RATE = 0.9;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hoursAgo(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

function decayFrequency(frequency: number, hoursElapsed: number): number {
  const daysElapsed = hoursElapsed / 24;
  if (daysElapsed <= DECAY_DAYS) return frequency;
  const excessDays = daysElapsed - DECAY_DAYS;
  return frequency * Math.pow(DECAY_RATE, excessDays);
}

class AdaptiveScheduler {
  private patterns: ActivityPattern[] = [];

  recordActivity(activityType: string): void {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    this.applyDecay();

    const existing = this.patterns.find(
      (p) =>
        p.hour === hour &&
        p.dayOfWeek === dayOfWeek &&
        p.activityType === activityType,
    );

    if (existing) {
      existing.frequency += 1;
      existing.lastObserved = now;
      return;
    }

    if (this.patterns.length >= MAX_PATTERNS) {
      this.pruneWeakestPattern();
    }

    this.patterns.push({
      hour,
      dayOfWeek,
      activityType,
      frequency: 1,
      lastObserved: now,
    });
  }

  predictOptimalTime(activityType: string): TimeSlotPrediction | null {
    this.applyDecay();

    const relevant = this.patterns.filter((p) => p.activityType === activityType);
    if (relevant.length === 0) return null;

    const best = relevant.reduce((a, b) => (a.frequency >= b.frequency ? a : b));
    const totalFreq = relevant.reduce((s, p) => s + p.frequency, 0);
    const confidence = best.frequency / totalFreq;

    return {
      activityType,
      bestHour: best.hour,
      bestDayOfWeek: best.dayOfWeek,
      confidence,
      reason: `${activityType} peaks at ${best.hour}:00 on ${DAY_NAMES[best.dayOfWeek]} (observed ${best.frequency}×, ${(confidence * 100).toFixed(0)}% confidence)`,
    };
  }

  scheduleSmart(task: SmartTask): { scheduledHour: number; scheduledDay: number } {
    const prediction = this.predictOptimalTime(task.activityType);

    if (prediction && prediction.confidence > 0.3) {
      return {
        scheduledHour: prediction.bestHour,
        scheduledDay: prediction.bestDayOfWeek,
      };
    }

    const now = new Date();
    const fallbackHour = task.priority === "high" ? 10 : task.priority === "medium" ? 14 : 20;

    const bestFutureSlot = this.findBestFutureSlot(task.activityType, now, fallbackHour);

    return {
      scheduledHour: bestFutureSlot.hour,
      scheduledDay: bestFutureSlot.day,
    };
  }

  getSuggestedTimeSlot(description: string): string {
    const activityType = this.inferActivityType(description);
    const prediction = this.predictOptimalTime(activityType);

    if (prediction) {
      return `Best time for "${description}" is ${DAY_NAMES[prediction.bestDayOfWeek]} at ${prediction.bestHour}:00 — ${prediction.reason}`;
    }

    const fallback = this.getFallbackSuggestion(activityType);
    return fallback
      ? `No strong pattern yet for "${description}". ${fallback}`
      : `No learned patterns for "${description}" yet. Start performing this activity and I'll learn your rhythm.`;
  }

  getPatternReport(): PatternReport {
    this.applyDecay();

    if (this.patterns.length === 0) {
      return {
        totalPatterns: 0,
        topActivityTypes: [],
        mostActiveHour: null,
        mostActiveDay: null,
        hourlyDistribution: new Array(24).fill(0),
        dailyDistribution: new Array(7).fill(0),
        oldestPatternAge: null,
        newestPatternAge: null,
        summary: "No patterns learned yet. Start recording activities to build your schedule profile.",
      };
    }

    const activityMap = new Map<string, number>();
    const hourlyDist = new Array(24).fill(0);
    const dailyDist = new Array(7).fill(0);

    for (const p of this.patterns) {
      activityMap.set(p.activityType, (activityMap.get(p.activityType) || 0) + p.frequency);
      hourlyDist[p.hour] += p.frequency;
      dailyDist[p.dayOfWeek] += p.frequency;
    }

    const topActivityTypes = [...activityMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, totalFrequency]) => ({ type, totalFrequency }));

    let mostActiveHour: number | null = null;
    let maxHourFreq = -1;
    for (let h = 0; h < 24; h++) {
      if (hourlyDist[h] > maxHourFreq) {
        maxHourFreq = hourlyDist[h];
        mostActiveHour = h;
      }
    }

    let mostActiveDay: number | null = null;
    let maxDayFreq = -1;
    for (let d = 0; d < 7; d++) {
      if (dailyDist[d] > maxDayFreq) {
        maxDayFreq = dailyDist[d];
        mostActiveDay = d;
      }
    }

    const ages = this.patterns.map((p) => hoursAgo(p.lastObserved));
    const oldestPatternAge = Math.max(...ages) / 24;
    const newestPatternAge = Math.min(...ages) / 24;

    const topType = topActivityTypes[0];
    const peakDayStr = mostActiveDay !== null ? DAY_NAMES[mostActiveDay] : "—";
    const peakHourStr = mostActiveHour !== null ? `${mostActiveHour}:00` : "—";

    const summary = [
      `${this.patterns.length} patterns tracked across ${activityMap.size} activity types.`,
      topType ? `Most frequent: ${topType.type} (${topType.totalFrequency}×).` : null,
      mostActiveHour !== null ? `Peak hour: ${peakHourStr}.` : null,
      mostActiveDay !== null ? `Peak day: ${peakDayStr}.` : null,
      `Oldest data: ${oldestPatternAge.toFixed(1)}d ago. Newest: ${newestPatternAge.toFixed(1)}d ago.`,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      totalPatterns: this.patterns.length,
      topActivityTypes,
      mostActiveHour,
      mostActiveDay,
      hourlyDistribution: hourlyDist,
      dailyDistribution: dailyDist,
      oldestPatternAge,
      newestPatternAge,
      summary,
    };
  }

  reset(): void {
    this.patterns = [];
  }

  private applyDecay(): void {
    for (const p of this.patterns) {
      const elapsed = hoursAgo(p.lastObserved);
      p.frequency = Math.max(0.01, decayFrequency(p.frequency, elapsed));
    }

    this.patterns = this.patterns.filter((p) => p.frequency >= 0.01);
  }

  private pruneWeakestPattern(): void {
    if (this.patterns.length === 0) return;
    let weakestIdx = 0;
    for (let i = 1; i < this.patterns.length; i++) {
      if (this.patterns[i].frequency < this.patterns[weakestIdx].frequency) {
        weakestIdx = i;
      }
    }
    this.patterns.splice(weakestIdx, 1);
  }

  private findBestFutureSlot(
    activityType: string,
    from: Date,
    fallbackHour: number,
  ): { hour: number; day: number } {
    const relevant = this.patterns.filter((p) => p.activityType === activityType);
    if (relevant.length === 0) {
      return { hour: fallbackHour, day: from.getDay() };
    }

    const sorted = [...relevant].sort((a, b) => b.frequency - a.frequency);

    for (const candidate of sorted) {
      const candidateDate = this.nextOccurrence(from, candidate.dayOfWeek, candidate.hour);
      if (candidateDate.getTime() > from.getTime()) {
        return { hour: candidate.hour, day: candidate.dayOfWeek };
      }
    }

    return { hour: sorted[0].hour, day: sorted[0].dayOfWeek };
  }

  private nextOccurrence(from: Date, targetDay: number, targetHour: number): Date {
    const result = new Date(from);
    const currentDay = result.getDay();
    const currentHour = result.getHours();

    let daysAhead = targetDay - currentDay;
    if (daysAhead < 0 || (daysAhead === 0 && targetHour <= currentHour)) {
      daysAhead += 7;
    }

    result.setDate(result.getDate() + daysAhead);
    result.setHours(targetHour, 0, 0, 0);
    return result;
  }

  private inferActivityType(description: string): string {
    const lower = description.toLowerCase();

    const keywordMap: Array<[string[], string]> = [
      [["email", "e-mail", "inbox", "reply"], "email"],
      [["meeting", "call", "sync", "standup", "stand-up"], "meeting"],
      [["code", "develop", "implement", "build", "program"], "coding"],
      [["review", "check", "audit", "pr"], "review"],
      [["plan", "schedule", "organize", "prioritize"], "planning"],
      [["document", "write", "draft", "blog"], "documentation"],
      [["test", "qa", "verify", "validate"], "testing"],
      [["design", "ui", "ux", "mockup", "wireframe"], "design"],
      [["research", "investigate", "explore", "study"], "research"],
      [["exercise", "workout", "run", "gym", "walk"], "exercise"],
      [["read", "book", "article"], "reading"],
      [["clean", "tidy", "organize space"], "organizing"],
      [["focus", "deep work", "concentrate"], "deep-work"],
      [["break", "rest", "relax", "pause"], "break"],
    ];

    for (const [keywords, type] of keywordMap) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return type;
      }
    }

    return "general";
  }

  private getFallbackSuggestion(activityType: string): string | null {
    const patterns = this.patterns.filter((p) => p.activityType === activityType);
    if (patterns.length === 0) return null;

    const hourBuckets = new Array(24).fill(0);
    for (const p of patterns) {
      hourBuckets[p.hour] += p.frequency;
    }

    let bestHour = 0;
    for (let h = 1; h < 24; h++) {
      if (hourBuckets[h] > hourBuckets[bestHour]) {
        bestHour = h;
      }
    }

    return `Closest pattern suggests ${bestHour}:00 based on partial data.`;
  }
}

const adaptiveScheduler = new AdaptiveScheduler();
export default adaptiveScheduler;
