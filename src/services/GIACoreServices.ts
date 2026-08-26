import { logger } from '../utils/logger';
import { autoMemory } from './AutoMemory';
import { automationEngine } from './AutomationEngine';
import { giaTwin } from './GiaTwin';
import { moodService } from './MoodService';
import { screenAgent } from './ScreenAgent';
import { cloudSync } from './CloudSync';
import { crossDeviceMesh } from './CrossDeviceMesh';
import { skillsSDK } from './SkillsSDK';
import { knowledgeGraphService } from './KnowledgeGraphService';
import { useMemoryStore } from '../store/useMemoryStore';
import { useMoodStore } from '../store/useMoodStore';
import { useKnowledgeGraphStore } from '../store/useKnowledgeGraphStore';
import { useSyncStore } from '../store/useSyncStore';
import { neuraBridge } from './NeuraBridge';

export class GIAFeatureFlags {
  private features: Map<string, boolean> = new Map([
    ['knowledgeGraph', true],
    ['autoMemory', true],
    ['automationEngine', true],
    ['giaTwin', true],
    ['moodDetection', true],
    ['screenAgent', false],
    ['cloudSync', false],
    ['crossDeviceMesh', false],
    ['skillsSDK', true],
    ['notificationListener', false],
    ['offlineSTT', false],
  ]);

  private static STORAGE_KEY = 'gia-feature-flags';

  constructor() {
    // Restore user overrides from a previous session so toggles survive restarts.
    try {
      const raw = localStorage.getItem(GIAFeatureFlags.STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, boolean>;
        for (const [key, value] of Object.entries(saved)) {
          if (typeof value === 'boolean') this.features.set(key, value);
        }
      }
    } catch { /* noop */ }
  }

  isEnabled(feature: string): boolean {
    return this.features.get(feature) ?? false;
  }

  setEnabled(feature: string, enabled: boolean): void {
    this.features.set(feature, enabled);
    try {
      localStorage.setItem(GIAFeatureFlags.STORAGE_KEY, JSON.stringify(Object.fromEntries(this.features)));
    } catch { /* noop */ }
    logger.info(`[FeatureFlags] ${feature}: ${enabled ? 'enabled' : 'disabled'}`);
  }

  toggle(feature: string): boolean {
    const current = this.isEnabled(feature);
    this.setEnabled(feature, !current);
    return !current;
  }

  getAll(): Record<string, boolean> {
    return Object.fromEntries(this.features);
  }
}

export const featureFlags = new GIAFeatureFlags();

class GIACoreServices {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('[GIACoreServices] Initializing...');

    if (featureFlags.isEnabled('autoMemory')) {
      autoMemory.updateConfig({ enabled: true });
      logger.info('[GIACoreServices] AutoMemory ready');
    }

    if (featureFlags.isEnabled('automationEngine')) {
      automationEngine.registerAction('log', async (params) => {
        logger.info('[AutomationAction]', params.message || 'triggered');
      });
      automationEngine.start();
      logger.info('[GIACoreServices] AutomationEngine ready');
    }

    if (featureFlags.isEnabled('giaTwin')) {
      const stats = giaTwin.getStats();
      logger.info(`[GIACoreServices] GIA Twin ready (${stats.samplesCount} samples)`);
    }

    if (featureFlags.isEnabled('moodDetection')) {
      const current = useMoodStore.getState().getCurrentMood();
      logger.info(`[GIACoreServices] MoodService ready (current: ${current})`);
    }

    if (featureFlags.isEnabled('knowledgeGraph')) {
      const kg = useKnowledgeGraphStore.getState();
      logger.info(`[GIACoreServices] KnowledgeGraph ready (${kg.entities.length} entities, ${kg.relationships.length} relationships)`);
    }

    if (featureFlags.isEnabled('skillsSDK')) {
      const skills = skillsSDK.getInstalledSkills();
      logger.info(`[GIACoreServices] SkillsSDK ready (${skills.length} installed)`);
    }

    if (featureFlags.isEnabled('cloudSync')) {
      const config = useSyncStore.getState().config;
      if (config.enabled) {
        cloudSync.start();
      }
      logger.info('[GIACoreServices] CloudSync ready');
    }

    if (featureFlags.isEnabled('crossDeviceMesh')) {
      crossDeviceMesh.startLocalBroadcast();
      logger.info('[GIACoreServices] CrossDeviceMesh ready');
    }

    neuraBridge.init();
    logger.info('[GIACoreServices] NeuraBridge ready — Neura tools exposed for external MCP agents');

    this.initialized = true;
    logger.info('[GIACoreServices] All services initialized');
  }

  async onMessage(text: string, messageId: string, role: 'user' | 'assistant'): Promise<void> {
    if (!this.initialized) return;

    const tasks: Promise<void>[] = [];

    if (featureFlags.isEnabled('autoMemory')) {
      tasks.push(autoMemory.processMessage(text, messageId, role));
    }

    if (featureFlags.isEnabled('knowledgeGraph') && text.length > 30) {
      tasks.push(knowledgeGraphService.extractFromText(text, messageId));
    }

    if (featureFlags.isEnabled('giaTwin') && role === 'user') {
      tasks.push(giaTwin.learnFromMessage(text, 'chat'));
    }

    if (featureFlags.isEnabled('moodDetection') && role === 'user') {
      moodService.recordMood(text, 'message');
    }

    if (role === 'user') {
      tasks.push(this.extractPreferences(text));
    }

    await Promise.allSettled(tasks);
  }

  private async extractPreferences(text: string): Promise<void> {
    const preferences: { name: string; type: 'preference' | 'habit' | 'goal'; description: string; confidence: number }[] = [];

    const patterns: { regex: RegExp; type: 'preference' | 'habit' | 'goal' }[] = [
      // Preferences
      { regex: /\bI (?:really\s+)?(?:like|love|enjoy|adore)\s+(\w+(?:\s+\w+){0,4})/gi, type: 'preference' },
      { regex: /\bMy\s+favo(u?:rite|urite)\s+\w+\s+(?:is|are)\s+(\w+(?:\s+\w+){0,4})/gi, type: 'preference' },
      { regex: /\bI\s+prefer\s+(\w+(?:\s+\w+){0,4})(?:\s+over\s+|\s+to\s+)/gi, type: 'preference' },
      { regex: /\bI\s+(?:don't|dont|do not)\s+(?:like|enjoy)\s+(\w+(?:\s+\w+){0,4})/gi, type: 'preference' },
      { regex: /\bI'm\s+(?:really\s+)?into\s+(\w+(?:\s+\w+){0,4})/gi, type: 'preference' },
      { regex: /\bI\s+(?:love|like|enjoy)\s+(?:it\s+)?when\s+(\w+(?:\s+\w+){0,4})/gi, type: 'preference' },
      // Habits
      { regex: /\bI\s+(?:always|usually|typically|often|frequently)\s+(\w+(?:\s+\w+){0,5})/gi, type: 'habit' },
      { regex: /\bI\s+(?:never|rarely|seldom)\s+(\w+(?:\s+\w+){0,4})/gi, type: 'habit' },
      { regex: /\bI\s+(?:have\s+a\s+habit\s+of|tend\s+to)\s+(\w+(?:\s+\w+){0,4})/gi, type: 'habit' },
      // Goals
      { regex: /\bI\s+(?:want\s+to|would\s+love\s+to|wish\s+to|hope\s+to)\s+(\w+(?:\s+\w+){0,5})/gi, type: 'goal' },
      { regex: /\bI'm?\s+(?:trying\s+to|working\s+on|learning\s+to|planning\s+to)\s+(\w+(?:\s+\w+){0,5})/gi, type: 'goal' },
      { regex: /\b(?:My\s+goal|My\s+aim|My\s+objective)\s+(?:is|are)\s+(?:to\s+)?(\w+(?:\s+\w+){0,5})/gi, type: 'goal' },
    ];

    for (const { regex, type } of patterns) {
      let match: RegExpExecArray | null;
      const re = new RegExp(regex.source, regex.flags);
      while ((match = re.exec(text)) !== null) {
        const phrase = match[1] || match[2] || '';
        if (!phrase || phrase.length < 3) continue;
        const clean = phrase.replace(/[.,!?;:]+$/, '').trim();
        if (!clean || clean.length < 3) continue;
        const confidence = type === 'preference' ? 0.55 : type === 'habit' ? 0.5 : 0.6;
        if (!preferences.some(p => p.name.toLowerCase() === clean.toLowerCase())) {
          preferences.push({ name: clean, type, description: text.slice(Math.max(0, match.index - 10), match.index + match[0].length + 20).trim(), confidence });
        }
      }
    }

    if (preferences.length === 0) return;

    const kg = useKnowledgeGraphStore.getState();
    for (const p of preferences) {
      try {
        kg.addEntity({
          name: p.name,
          type: p.type,
          description: p.description,
          aliases: [],
          confidence: p.confidence,
          metadata: { source: 'preference_extraction', detected: Date.now().toString() },
        });
      } catch {
        // non-critical
      }
    }
  }

  async onAppStart(): Promise<void> {
    await this.initialize();

    if (featureFlags.isEnabled('skillsSDK')) {
      await skillsSDK.executeHooks('on_app_start', { timestamp: Date.now() });
    }

    this.periodicMaintenance();
  }

  private maintenanceInterval: ReturnType<typeof setInterval> | null = null;
  private periodicMaintenance(): void {
    if (this.maintenanceInterval) return;

    this.maintenanceInterval = setInterval(() => {
      useMemoryStore.getState().compactMemories();
      useKnowledgeGraphStore.getState().applyDecay();
      useKnowledgeGraphStore.getState().compact();
      logger.debug('[GIACoreServices] Maintenance: decay + compacted memories & knowledge graph');
    }, 3600000);
  }

  getStatus(): string {
    const lines: string[] = ['## GIA Core Services Status'];
    const flags = featureFlags.getAll();

    for (const [feature, enabled] of Object.entries(flags)) {
      lines.push(`- ${feature}: ${enabled ? '✅' : '⬜'}`);
    }

    lines.push('', '### Service Status:');
    if (featureFlags.isEnabled('automationEngine')) lines.push(automationEngine.getStatus());
    if (featureFlags.isEnabled('cloudSync')) lines.push(cloudSync.getStatus());
    if (featureFlags.isEnabled('crossDeviceMesh')) lines.push(crossDeviceMesh.getStatus());
    if (featureFlags.isEnabled('skillsSDK')) lines.push(skillsSDK.getStats());
    if (featureFlags.isEnabled('giaTwin')) {
      const stats = giaTwin.getStats();
      lines.push(`Twin: ${stats.samplesCount} samples, ${(stats.confidence * 100).toFixed(0)}% confidence`);
    }
    if (featureFlags.isEnabled('screenAgent')) {
      const sa = screenAgent.getStatus();
      lines.push(`Screen Agent: ${sa.isActive ? 'active' : 'inactive'}, watching: ${sa.watching}`);
    }

    return lines.join('\n');
  }

  async getContextEnhancements(query?: string): Promise<string> {
    const parts: string[] = [];

    if (featureFlags.isEnabled('knowledgeGraph')) {
      const graphCtx = useKnowledgeGraphStore.getState().getGraphContext(query || '');
      if (graphCtx) parts.push(graphCtx);
    }

    if (featureFlags.isEnabled('moodDetection')) {
      const moodCtx = moodService.generateMoodContext();
      if (moodCtx) parts.push(moodCtx);
    }

    if (featureFlags.isEnabled('giaTwin')) {
      const twinPrompt = giaTwin.generatePersonalizedPrompt();
      if (twinPrompt) parts.push(twinPrompt);
    }

    return parts.join('\n\n');
  }
}

export const giaCoreServices = new GIACoreServices();
