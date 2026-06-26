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

  isEnabled(feature: string): boolean {
    return this.features.get(feature) ?? false;
  }

  setEnabled(feature: string, enabled: boolean): void {
    this.features.set(feature, enabled);
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

    this.initialized = true;
    logger.info('[GIACoreServices] All services initialized');
  }

  async onMessage(text: string, messageId: string, role: 'user' | 'assistant'): Promise<void> {
    if (!this.initialized) return;

    const tasks: Promise<void>[] = [];

    if (featureFlags.isEnabled('autoMemory')) {
      tasks.push(autoMemory.processMessage(text, messageId, role));
    }

    if (featureFlags.isEnabled('knowledgeGraph') && role === 'user' && text.length > 30) {
      tasks.push(knowledgeGraphService.extractFromText(text, messageId));
    }

    if (featureFlags.isEnabled('giaTwin') && role === 'user') {
      tasks.push(giaTwin.learnFromMessage(text, 'chat'));
    }

    if (featureFlags.isEnabled('moodDetection') && role === 'user') {
      moodService.recordMood(text, 'message');
    }

    await Promise.allSettled(tasks);
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
      useKnowledgeGraphStore.getState().compact();
      logger.debug('[GIACoreServices] Maintenance: compacted memories & knowledge graph');
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
