import { useKnowledgeGraphStore } from '../store/useKnowledgeGraphStore';
import { useMemoryStore } from '../store/useMemoryStore';
import GiaTools from './GiaTools';
import { logger } from '../utils/logger';
import type { Tool } from './tools/types';
import type { EntityType } from '../types/knowledge';

const NEURA_BRIDGE_ID = 'neura-internal';

const neuraTools: Tool[] = [
  {
    id: `mcp__${NEURA_BRIDGE_ID}__neura_query`,
    name: `mcp__${NEURA_BRIDGE_ID}__neura_query`,
    description: '[Neura] Query the knowledge graph for entities and relationships related to a topic. Returns known people, projects, concepts, locations, and how they connect.',
    schema: { type: 'object' as const, properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] },
    execute: async ({ query, maxResults }: Record<string, unknown>) => {
      const q = String(query ?? '');
      const limit = Math.min(Math.max(Number(maxResults) || 8, 1), 20);
      const store = useKnowledgeGraphStore.getState();
      const entities = store.queryEntities(q).slice(0, limit);
      if (entities.length === 0) return { success: true, content: 'No relevant entities found.' };
      const lines: string[] = [];
      for (const e of entities) {
        const rels = store.getRelationships(e.id);
        const mem = useMemoryStore.getState().queryMemories(e.name).slice(0, 3);
        lines.push(`${e.name} (${e.type}) — confidence ${(e.confidence * 100).toFixed(0)}%`);
        if (e.description) lines.push(`  ${e.description}`);
        for (const r of rels.slice(0, 5)) {
          const t = store.getEntity(r.sourceId === e.id ? r.targetId : r.sourceId);
          if (t) lines.push(`  → ${r.type.replace(/_/g, ' ')} → ${t.name}`);
        }
        for (const m of mem) lines.push(`  📝 ${m.key}: ${m.value.slice(0, 120)}`);
      }
      return { success: true, content: lines.join('\n') };
    },
  },
  {
    id: `mcp__${NEURA_BRIDGE_ID}__neura_add`,
    name: `mcp__${NEURA_BRIDGE_ID}__neura_add`,
    description: '[Neura] Add an entity or relationship to the knowledge graph. External agents use this to persist learned information.',
    schema: {
      type: 'object' as const, properties: {
        name: { type: 'string' }, type: { type: 'string', enum: ['person', 'project', 'concept', 'location', 'organization', 'event', 'technology', 'tool', 'topic', 'habit', 'goal', 'preference'] },
        description: { type: 'string' }, aliases: { type: 'string' }, confidence: { type: 'number' },
      }, required: ['name', 'type', 'description'],
    },
    execute: async ({ name, type, description, aliases, confidence }: Record<string, unknown>) => {
      const n = String(name ?? '');
      const t = String(type ?? 'concept') as EntityType;
      const store = useKnowledgeGraphStore.getState();
      const existing = store.findEntity(n);
      const conf = Math.min(1, Math.max(0, Number(confidence) || 0.7));
      const al = String(aliases ?? '').split(',').map(s => s.trim()).filter(Boolean);
      if (existing) {
        store.addEntity({ name: n, type: t, aliases: al.length > 0 ? al : existing.aliases, description: String(description ?? ''), confidence: Math.max(existing.confidence, conf), metadata: { source: 'mcp_bridge' } });
        return { success: true, content: `Updated "${n}" in Neura.` };
      }
      store.addEntity({ name: n, type: t, aliases: al, description: String(description ?? ''), confidence: conf, metadata: { source: 'mcp_bridge' } });
      return { success: true, content: `Added "${n}" (${t}) to Neura.` };
    },
  },
  {
    id: `mcp__${NEURA_BRIDGE_ID}__neura_related`,
    name: `mcp__${NEURA_BRIDGE_ID}__neura_related`,
    description: '[Neura] Find entities connected to a specific entity in the knowledge graph, up to N degrees of separation.',
    schema: { type: 'object' as const, properties: { name: { type: 'string' }, depth: { type: 'number' } }, required: ['name'] },
    execute: async ({ name, depth }: Record<string, unknown>) => {
      const q = String(name ?? '');
      const d = Math.min(Math.max(Number(depth) || 2, 1), 3);
      const store = useKnowledgeGraphStore.getState();
      const entity = store.findEntity(q);
      if (!entity) return { success: true, content: `No entity "${q}" found.` };
      const related = store.getRelatedEntities(entity.id, d);
      const rels = store.getRelationships(entity.id);
      const lines: string[] = [`${entity.name} (${entity.type}) — ${related.length} entities in network (depth ${d})`];
      for (const r of rels.slice(0, 10)) {
        const t = store.getEntity(r.sourceId === entity.id ? r.targetId : r.sourceId);
        if (t) lines.push(`  ${r.type.replace(/_/g, ' ')} → ${t.name}`);
      }
      for (const r of related.slice(0, 10)) lines.push(`  • ${r.name} (${r.type})`);
      return { success: true, content: lines.join('\n') };
    },
  },
  {
    id: `mcp__${NEURA_BRIDGE_ID}__neura_stats`,
    name: `mcp__${NEURA_BRIDGE_ID}__neura_stats`,
    description: '[Neura] Get statistics about the knowledge graph — entity count, relationship count, top entities, recent activity.',
    schema: { type: 'object' as const, properties: {} },
    execute: async () => {
      const store = useKnowledgeGraphStore.getState();
      const { entities, relationships } = store;
      const typeCount: Record<string, number> = {};
      for (const e of entities) typeCount[e.type] = (typeCount[e.type] || 0) + 1;
      const top = [...entities].sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 5);
      const recent = [...entities].sort((a, b) => b.lastMentioned - a.lastMentioned).slice(0, 3);
      const lines = [
        `Neura: ${entities.length} entities, ${relationships.length} relationships`,
        `Types: ${Object.entries(typeCount).map(([t, c]) => `${t}(${c})`).join(', ')}`,
        `Top: ${top.map(e => `${e.name}(${e.mentionCount}x)`).join(', ')}`,
        `Recent: ${recent.map(e => e.name).join(', ')}`,
      ];
      return { success: true, content: lines.join('\n') };
    },
  },
  {
    id: `mcp__${NEURA_BRIDGE_ID}__neura_evolve`,
    name: `mcp__${NEURA_BRIDGE_ID}__neura_evolve`,
    description: '[Neura] Show how the knowledge graph has evolved — new entities, confidence growth, new connections.',
    schema: { type: 'object' as const, properties: { days: { type: 'number' } } },
    execute: async ({ days }: Record<string, unknown>) => {
      const d = Math.max(1, Math.min(365, Number(days) || 7));
      const cutoff = Date.now() - d * 86400000;
      const store = useKnowledgeGraphStore.getState();
      const { entities, relationships, mentions } = store;
      const newEntities = entities.filter(e => e.firstMentioned > cutoff);
      const newRels = relationships.filter(r => r.firstObserved > cutoff);
      const grown = entities.filter(e => mentions.filter(m => m.entityId === e.id && m.timestamp > cutoff).length > 1).sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 5);
      const lines = [`Neura Evolution (${d}d): +${newEntities.length} entities, +${newRels.length} connections`];
      for (const e of newEntities.slice(0, 5)) lines.push(`  + ${e.name} (${e.type})`);
      for (const e of grown) lines.push(`  ↑ ${e.name}: ${(e.confidence * 100).toFixed(0)}% (${e.mentionCount}m)`);
      return { success: true, content: lines.join('\n') };
    },
  },
];

class NeuraBridge {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    for (const tool of neuraTools) {
      try {
        GiaTools.registerTool(tool);
      } catch (e) {
        logger.warn('[NeuraBridge] Failed to register tool:', tool.name, e);
      }
    }
    this.initialized = true;
    logger.info(`[NeuraBridge] Registered ${neuraTools.length} Neura tools for MCP external access`);
  }

  shutdown(): void {
    if (!this.initialized) return;
    for (const tool of neuraTools) {
      try {
        GiaTools.unregisterTool(tool.id);
      } catch {
        // ok
      }
    }
    this.initialized = false;
  }
}

export const neuraBridge = new NeuraBridge();
