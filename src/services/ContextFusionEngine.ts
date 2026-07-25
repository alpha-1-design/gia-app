import { knowledgeGraphService } from './KnowledgeGraphService';
import { useMemoryStore, type MemoryEntry } from '../store/useMemoryStore';
import { useGiaStore } from '../store/useGiaStore';
import { logger } from '../utils/logger';
import type { Tool } from './tools/types';
import ToolRegistry from './ToolRegistry';

export type TimeOfDay = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'late_night';
export type SuggestionType = 'morning_prep' | 'entity_followup' | 'wellness_check' | 'memory_cleanup' | 'end_of_day' | 'calendar_reminder' | 'focus_mode' | 'social_prompt';

export interface ProactiveSuggestion {
  type: SuggestionType;
  priority: number;
  message: string;
  context: string;
  timestamp: number;
}
export interface KGEntity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

const CACHE_TTL_MS = 30_000;

class ContextFusionEngine {
  private fusionCache: FusionResult | null = null;
  private fusionCacheTime = 0;
  private activityLog: ActivityPattern[] = [];
  private sessionInteractionCount = 0;
  private sessionStart = Date.now();

  recordActivity(type: string): void {
    const now = Date.now();
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const existing = this.activityLog.findIndex(p => p.hour === hour && p.dayOfWeek === day && p.activityType === type);
    if (existing >= 0) {
      this.activityLog[existing].interactionCount++;
      this.activityLog[existing].lastSeen = now;
    } else {
      this.activityLog.push({ hour, dayOfWeek: day, activityType: type, interactionCount: 1, lastSeen: now });
    }
    if (this.activityLog.length > 500) this.activityLog = this.activityLog.slice(-400);
  }

  async fuse(query?: string): Promise<FusionResult> {
    const now = Date.now();
    if (this.fusionCache && (now - this.fusionCacheTime) < CACHE_TTL_MS) return this.fusionCache;
    const signals = this.gatherSignals();
    const suggestions = this.generateSuggestions(signals, query);
    const snippet = this.buildPromptSnippet(signals);
    const result: FusionResult = { signals, suggestions, fusedAt: now, systemPromptSnippet: snippet };
    this.fusionCache = result;
    this.fusionCacheTime = now;
    return result;
  }

  async getSystemPromptContext(): Promise<string> {
    const { signals } = await this.fuse();
    const lines: string[] = ['## Live Context'];
    lines.push(`Time: ${signals.timeOfDay}`);
    if (signals.activeEntities.length > 0) lines.push(`Recent topics: ${signals.activeEntities.slice(0, 5).map(e => e.name).join(', ')}`);
    if (signals.topMemories.length > 0) lines.push(`Recent memories: ${signals.topMemories.slice(0, 3).map(m => m.value).join('; ')}`);
    if (signals.coreMemories.length > 0) lines.push(`Core facts: ${signals.coreMemories.map(m => m.value).join('; ')}`);
    lines.push(`Pending goals: ${signals.pendingGoals}`);
    return lines.join('\n');
  }

  async getSuggestions(max = 5): Promise<ProactiveSuggestion[]> {
    const { suggestions } = await this.fuse();
    return suggestions.slice(0, max);
  }

  getSessionInsights(): { interactionCount: number; durationMs: number; activityBreakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};
    for (const p of this.activityLog) { breakdown[p.activityType] = (breakdown[p.activityType] || 0) + p.interactionCount; }
    return { interactionCount: this.sessionInteractionCount, durationMs: Date.now() - this.sessionStart, activityBreakdown: breakdown };
  }

  predictNextActivity(): { activityType: string; confidence: number } | null {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const candidates = this.activityLog.filter(p => p.dayOfWeek === day && p.hour === hour).sort((a, b) => b.interactionCount - a.interactionCount);
    if (candidates.length === 0) return null;
    const total = candidates.reduce((s, c) => s + c.interactionCount, 0);
    return { activityType: candidates[0].activityType, confidence: candidates[0].interactionCount / total };
  }

  registerTool(id: string, tool: Tool): void { ToolRegistry.register(tool); }

  private gatherSignals(): ContextSignal {
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = hour < 6 ? 'late_night' as TimeOfDay : hour < 9 ? 'early_morning' : hour < 12 ? 'morning' : hour < 14 ? 'midday' : hour < 18 ? 'afternoon' : hour < 22 ? 'evening' : 'night' as TimeOfDay;
    const store = useGiaStore.getState();
    const recentMemories = (useMemoryStore.getState().memories || []).sort((a, b) => b.lastAccessed - a.lastAccessed).slice(0, 10);
    const allMemories = useMemoryStore.getState().getMemories();
    const coreMemories = allMemories.filter(m => ['profile', 'preference', 'goal', 'correction'].includes(m.category) && m.confidence >= 0.6).sort((a, b) => b.confidence - a.confidence).slice(0, 8);
    const activeEntities: KGEntity[] = [];
    return {
      moodLabel: 'neutral', moodScore: 0, moodTrend: 0, moodChanged: false,
      timeOfDay, hour,
      activeEntities, topMemories: recentMemories,
      twinProfile: null, twinConfidence: 0,
      upcomingEvents: [], coreMemories,
      pendingGoals: store.scheduledTasks?.length || 0,
    };
  }

  private generateSuggestions(): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];
    const now = Date.now();
    suggestions.push({ type: 'morning_prep', priority: 2, message: 'Want me to check your calendar and prep your day?', context: 'Morning routine', timestamp: now });
    suggestions.push({ type: 'entity_followup', priority: 1, message: 'Pending tasks from your goals need attention.', context: 'Task review', timestamp: now });
    return suggestions;
  }

  private buildPromptSnippet(signals: ContextSignal): string {
    return `## Session Context\nTime: ${signals.timeOfDay}\nEntity count: ${signals.activeEntities.length}\nPending goals: ${signals.pendingGoals}`;
  }
}

export interface ActivityPattern { hour: number; dayOfWeek: number; activityType: string; interactionCount: number; lastSeen: number; }
export interface FusionResult { signals: ContextSignal; suggestions: ProactiveSuggestion[]; fusedAt: number; systemPromptSnippet: string; }
export interface ContextSignal { moodLabel: string; moodScore: number; moodTrend: number; moodChanged: boolean; timeOfDay: TimeOfDay; hour: number; activeEntities: KGEntity[]; topMemories: MemoryEntry[]; twinProfile: unknown; twinConfidence: number; upcomingEvents: unknown[]; coreMemories: MemoryEntry[]; pendingGoals: number; }

export const contextFusionEngine = new ContextFusionEngine();
